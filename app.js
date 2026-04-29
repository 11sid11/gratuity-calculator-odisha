(function () {
  const form = document.getElementById("gratuityForm");
  const fields = {
    benefitDate: document.getElementById("benefitDate"),
    ceilingMode: document.getElementById("ceilingMode"),
    customCeilingWrap: document.getElementById("customCeilingWrap"),
    customCeiling: document.getElementById("customCeiling"),
    basicPay: document.getElementById("basicPay"),
    otherPay: document.getElementById("otherPay"),
    daRate: document.getElementById("daRate"),
    includeDa: document.getElementById("includeDa"),
    manualDa: document.getElementById("manualDa"),
    manualDaAmount: document.getElementById("manualDaAmount"),
    serviceYears: document.getElementById("serviceYears"),
    serviceMonths: document.getElementById("serviceMonths"),
    extraHalfYears: document.getElementById("extraHalfYears"),
    manualHalfYears: document.getElementById("manualHalfYears")
  };

  const output = {
    amount: document.getElementById("resultAmount"),
    subtitle: document.getElementById("resultSubtitle"),
    emoluments: document.getElementById("emolumentsOut"),
    halfYears: document.getElementById("halfYearsOut"),
    factor: document.getElementById("factorOut"),
    ceiling: document.getElementById("ceilingOut"),
    gross: document.getElementById("grossOut"),
    reduction: document.getElementById("reductionOut"),
    formula: document.getElementById("formulaText"),
    warnings: document.getElementById("warnings")
  };

  const ceilingHistory = [
    { from: 20240101, amount: 2000000, label: "Rs. 20.00 lakh" },
    { from: 20160101, amount: 1500000, label: "Rs. 15.00 lakh" },
    { from: 20060101, amount: 750000, label: "Rs. 7.50 lakh" },
    { from: 0, amount: 250000, label: "Rs. 2.50 lakh" }
  ];

  function numberValue(input) {
    const value = Number(input.value);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function integerValue(input) {
    const value = Math.floor(numberValue(input));
    return Number.isFinite(value) ? value : 0;
  }

  function formatDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateKey(value) {
    if (!value) return 0;
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return 0;
    return parts[0] * 10000 + parts[1] * 100 + parts[2];
  }

  function formatRupees(amount) {
    const rounded = Math.ceil(Math.max(0, amount || 0));
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(rounded).replace("₹", "Rs. ");
  }

  function formatLakh(amount) {
    if (!Number.isFinite(amount)) return "No ceiling";
    if (amount >= 100000) {
      return `Rs. ${(amount / 100000).toFixed(2)} lakh`;
    }
    return formatRupees(amount);
  }

  function getBenefitType() {
    return form.querySelector("input[name='benefitType']:checked").value;
  }

  function autoCeiling(key) {
    return ceilingHistory.find((entry) => key >= entry.from) || ceilingHistory[ceilingHistory.length - 1];
  }

  function getCeiling() {
    const mode = fields.ceilingMode.value;
    if (mode === "none" || getBenefitType() === "service") {
      return { amount: Infinity, label: "No DCRG ceiling applied" };
    }
    if (mode === "custom") {
      const customAmount = numberValue(fields.customCeiling);
      return {
        amount: customAmount > 0 ? customAmount : Infinity,
        label: customAmount > 0 ? formatLakh(customAmount) : "Custom ceiling missing"
      };
    }
    if (mode === "auto") {
      const entry = autoCeiling(dateKey(fields.benefitDate.value));
      return { amount: entry.amount, label: entry.label };
    }
    const amount = Number(mode);
    return { amount, label: formatLakh(amount) };
  }

  function getEmoluments(warnings) {
    const basicPay = numberValue(fields.basicPay);
    const otherPay = numberValue(fields.otherPay);
    const payForDa = basicPay;
    let daAmount = 0;

    if (fields.includeDa.checked) {
      if (fields.manualDa.checked) {
        daAmount = numberValue(fields.manualDaAmount);
      } else {
        daAmount = payForDa * (numberValue(fields.daRate) / 100);
      }
    }

    if (fields.includeDa.checked && !fields.manualDa.checked && numberValue(fields.daRate) === 0 && basicPay > 0) {
      warnings.push("DA is included but the DA rate is blank or zero. Enter the applicable DA rate for a more complete estimate.");
    }

    if (fields.includeDa.checked && dateKey(fields.benefitDate.value) < 20160101) {
      warnings.push("DA inclusion is selected for a pre-01.01.2016 date. Verify the applicable emoluments rule for that retirement/death date.");
    }

    return {
      basicPay,
      otherPay,
      daAmount,
      total: basicPay + otherPay + daAmount
    };
  }

  function getHalfYears() {
    const manual = fields.manualHalfYears.value.trim();
    const base = manual === ""
      ? Math.floor(((integerValue(fields.serviceYears) * 12) + Math.min(integerValue(fields.serviceMonths), 11)) / 6)
      : Math.max(0, Math.floor(Number(manual) || 0));
    const extra = Math.min(integerValue(fields.extraHalfYears), 10);
    return {
      base,
      extra,
      total: base + extra,
      usedManual: manual !== ""
    };
  }

  function getServiceYearsDecimal() {
    return integerValue(fields.serviceYears) + (Math.min(integerValue(fields.serviceMonths), 11) / 12);
  }

  function deathFactor(serviceYears, halfYears, usePost2016Slab) {
    if (serviceYears < 1) {
      return { factor: 2, label: "less than 1 year: 2 times emoluments" };
    }
    if (serviceYears < 5) {
      return { factor: 6, label: "1 year or more but less than 5 years: 6 times emoluments" };
    }
    if (usePost2016Slab && serviceYears < 11) {
      return { factor: 12, label: "5 years or more but less than 11 years: 12 times emoluments" };
    }
    if (usePost2016Slab && serviceYears < 20) {
      return { factor: 20, label: "11 years or more but less than 20 years: 20 times emoluments" };
    }
    if (!usePost2016Slab && serviceYears < 20) {
      return { factor: 12, label: "5 years or more but less than 20 years: 12 times emoluments" };
    }
    return {
      factor: Math.min(halfYears * 0.5, 33),
      label: "20 years or more: half month's emoluments for every completed six-monthly period, maximum 33 times"
    };
  }

  function calculate() {
    const warnings = [];
    const type = getBenefitType();
    const key = dateKey(fields.benefitDate.value);
    const emoluments = getEmoluments(warnings);
    const service = getHalfYears();
    const serviceYears = service.usedManual ? service.base / 2 : getServiceYearsDecimal();
    const ceiling = getCeiling();
    const usePost2016DeathSlab = key >= 20160101;
    let factor = 0;
    let gross = 0;
    let formulaText = "";
    let subtitle = "";
    let halfYearsUsed = service.base;

    if (type === "retirement") {
      const eligible = service.total >= 10;
      const cappedHalfYears = Math.min(service.total, 66);
      halfYearsUsed = cappedHalfYears;
      factor = eligible ? Math.min(cappedHalfYears * 0.25, 16.5) : 0;
      gross = emoluments.total * factor;
      formulaText = `Retirement gratuity = 1/4 x emoluments x completed six-monthly periods. Here: 0.25 x ${formatRupees(emoluments.total)} x ${cappedHalfYears} = ${formatRupees(gross)}, subject to 16.5x emoluments and the selected ceiling.`;
      subtitle = eligible ? "Retirement gratuity estimate under Rule 49." : "Retirement gratuity normally needs at least 5 years of qualifying service.";
      if (!eligible) {
        warnings.push("Rule 49 retirement gratuity applies after 5 years of qualifying service. Check whether service gratuity under Rule 47(5) applies instead.");
      }
      if (service.total > 66) {
        warnings.push("Half-years were capped at 66 because retirement gratuity is limited to 16.5 times emoluments.");
      }
    }

    if (type === "death") {
      halfYearsUsed = service.base;
      const slab = deathFactor(serviceYears, halfYearsUsed, usePost2016DeathSlab);
      factor = slab.factor;
      gross = emoluments.total * factor;
      formulaText = `Death gratuity slab used: ${slab.label}. ${formatRupees(emoluments.total)} x ${factor.toFixed(factor % 1 === 0 ? 0 : 2)} = ${formatRupees(gross)}, subject to the selected ceiling.`;
      subtitle = "Death gratuity estimate under Rule 49.";
      if (!usePost2016DeathSlab) {
        warnings.push("The pre-2016 death gratuity slab is being used because the selected date is before 01.01.2016.");
      }
      if (service.extra > 0) {
        warnings.push("Extra half-years are ignored for death gratuity in this calculator.");
      }
    }

    if (type === "service") {
      halfYearsUsed = service.base;
      factor = service.base * 0.5;
      gross = emoluments.total * factor;
      formulaText = `Service gratuity = half month's emoluments x completed six-monthly periods. Here: 0.5 x ${formatRupees(emoluments.total)} x ${service.base} = ${formatRupees(gross)}.`;
      subtitle = "Service gratuity estimate under Rule 47(5).";
      if (serviceYears >= 10) {
        warnings.push("Service gratuity is for cases before minimum pensionable service. With 10 or more years, pension/DCRG rules may apply instead.");
      }
      if (service.extra > 0) {
        warnings.push("Extra half-years are not applied to service gratuity in this calculator.");
      }
    }

    if (service.usedManual) {
      warnings.push("Manual completed half-years override is being used. This is best when it matches the official service book calculation.");
    }

    if (emoluments.total <= 0) {
      warnings.push("Enter last pay/emoluments to calculate an amount.");
    }

    if (type !== "service" && fields.ceilingMode.value === "custom" && !Number.isFinite(ceiling.amount)) {
      warnings.push("Custom ceiling is selected, but no valid custom ceiling amount has been entered.");
    }

    const payable = Math.ceil(Math.min(gross, ceiling.amount));
    const reduction = Math.ceil(Math.max(0, gross - payable));

    output.amount.textContent = formatRupees(payable);
    output.subtitle.textContent = subtitle;
    output.emoluments.textContent = formatRupees(emoluments.total);
    output.halfYears.textContent = String(halfYearsUsed);
    output.factor.textContent = `${factor.toFixed(factor % 1 === 0 ? 0 : 2)}x`;
    output.ceiling.textContent = ceiling.label;
    output.gross.textContent = formatRupees(gross);
    output.reduction.textContent = formatRupees(reduction);
    output.formula.textContent = formulaText;
    output.warnings.innerHTML = warnings.map((warning) => `<li>${warning}</li>`).join("");
  }

  function updateCeilingVisibility() {
    fields.customCeilingWrap.classList.toggle("is-hidden", fields.ceilingMode.value !== "custom");
  }

  function resetForm() {
    form.reset();
    setDefaultDate();
    fields.includeDa.checked = true;
    updateCeilingVisibility();
    calculate();
  }

  function setDefaultDate() {
    fields.benefitDate.value = formatDateValue(new Date());
  }

  form.addEventListener("input", calculate);
  form.addEventListener("change", () => {
    updateCeilingVisibility();
    calculate();
  });
  document.getElementById("resetButton").addEventListener("click", resetForm);
  document.getElementById("printButton").addEventListener("click", () => window.print());

  setDefaultDate();
  updateCeilingVisibility();
  calculate();
})();
