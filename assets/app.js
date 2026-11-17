/**
 * The Azusa Network — Coming Soon Password Gate, Webhook Integration, Subscriptions & Member Portal Logic
 */

(function () {
  'use strict';

  const PREVIEW_PASSWORD_LOWER = 'azusa123';
  const STORAGE_UNLOCK_KEY = 'azusa_preview_unlocked';
  const STORAGE_WEBHOOK_KEY = 'azusa_webhook_url';

  const TIER_CATALOG = {
    associate: {
      name: 'Associate Minister',
      shortBadge: 'Associate Minister · Active',
      monthly: 29,
      annualPerMonth: 29,
      annualTotal: 348,
    },
    minister: {
      name: 'Credentialed Minister',
      shortBadge: 'Credentialed Minister · Active',
      monthly: 59,
      annualPerMonth: 59,
      annualTotal: 708,
    },
    church: {
      name: 'Affiliated Church & Ministry',
      shortBadge: 'Affiliated Church & Ministry · Active',
      monthly: 149,
      annualPerMonth: 149,
      annualTotal: 1788,
    },
  };

  let state = {
    billingCadence: 'monthly', // 'monthly' | 'annual'
    activeView: 'public', // 'public' | 'portal'
    selectedTier: 'minister',
    customAmount: null,
    subscriber: {
      name: 'Pastor / Ministry Partner',
      email: 'leader@azusanetwork.com',
      org: 'River City Fellowship',
      tier: 'minister',
      memberId: 'AZN-2026-8419',
    },
  };

  // =========================================================================
  // WEBHOOK DISPATCHER (Direct Webhook + /api/webhook Serverless Route)
  // =========================================================================
  // Default webhook URL (can also be overridden via Vercel env var WEBHOOK_URL or in Member Portal)
  const DEFAULT_WEBHOOK_URL = 'https://move.vizylabs.com/webhook/506ffde9-4381-4fae-8377-375f71b9d0d6';
  const DEFAULT_WEBHOOK_SOURCE = 'azusanetwork.com';

  async function sendToWebhook(raw) {
    let savedWebhookUrl = DEFAULT_WEBHOOK_URL;
    try {
      savedWebhookUrl = localStorage.getItem(STORAGE_WEBHOOK_KEY) || DEFAULT_WEBHOOK_URL;
    } catch (_) {}

    const targetWebhook = raw.webhookUrl || savedWebhookUrl || DEFAULT_WEBHOOK_URL;

    // Exact n8n webhook body structure expected by move.vizylabs.com
    const fullPayload = {
      name: raw.name || 'Launch Notification Subscriber',
      company: raw.company || raw.ministry || 'Azusa Network',
      email: raw.email || '',
      projectType: raw.projectType || raw.topic || raw.event || 'website-inquiry',
      message:
        raw.message ||
        (raw.event === 'launch_notify'
          ? 'Requested launch notification on azusanetwork.com Coming Soon page.'
          : 'Submitted via azusanetwork.com'),
      submittedAt: new Date().toISOString(),
      source: DEFAULT_WEBHOOK_SOURCE,
    };

    // 1. Call /api/webhook serverless route on Vercel (sends via Node fetch with "user-agent": "node")
    try {
      const apiRes = await fetch('/api/webhook', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          raw.webhookUrl ? { ...fullPayload, webhookUrl: targetWebhook } : fullPayload
        ),
      });
      if (apiRes.ok) {
        return await apiRes.json();
      }
    } catch (_) {}

    // 2. Direct client-side fallback (for static previews without /api/webhook)
    if (targetWebhook && /^https?:\/\//i.test(targetWebhook)) {
      try {
        const directRes = await fetch(targetWebhook, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fullPayload),
        });
        return {
          ok: true,
          forwarded: directRes.ok,
          webhookStatus: directRes.status,
        };
      } catch (err2) {
        return { ok: false, error: err2 && err2.message ? err2.message : 'Webhook error' };
      }
    }

    return { ok: true, forwarded: false, webhookConfigured: false };
  }

  // =========================================================================
  // COMING SOON LANDING GATE & LOGO PASSWORD MODAL
  // =========================================================================
  const comingSoonLogoTop = document.getElementById('comingSoonLogoTop');
  const comingSoonLogoCenter = document.getElementById('comingSoonLogoCenter');
  const passwordModal = document.getElementById('passwordModal');
  const closePwModalBtn = document.getElementById('closePwModalBtn');
  const passwordUnlockForm = document.getElementById('passwordUnlockForm');
  const previewPasswordInput = document.getElementById('previewPasswordInput');
  const pwErrorMsg = document.getElementById('pwErrorMsg');
  const lockSiteBtns = document.querySelectorAll('[data-lock-site]');
  const comingSoonNotifyForm = document.getElementById('comingSoonNotifyForm');
  const notifyFeedback = document.getElementById('notifyFeedback');
  const notifySubmitBtn = document.getElementById('notifySubmitBtn');

  function unlockSite() {
    document.body.classList.remove('locked-mode');
    try {
      sessionStorage.setItem(STORAGE_UNLOCK_KEY, 'true');
    } catch (_) {}
    closePasswordModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function lockSite() {
    document.body.classList.add('locked-mode');
    try {
      sessionStorage.removeItem(STORAGE_UNLOCK_KEY);
    } catch (_) {}
    if (primaryNav) primaryNav.classList.remove('mobile-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Restore session unlock state if previously unlocked in this tab
  try {
    if (sessionStorage.getItem(STORAGE_UNLOCK_KEY) === 'true') {
      document.body.classList.remove('locked-mode');
    }
  } catch (_) {}

  function openPasswordModal() {
    if (!passwordModal) return;
    if (pwErrorMsg) pwErrorMsg.textContent = '';
    if (previewPasswordInput) previewPasswordInput.value = '';
    passwordModal.classList.add('open');
    passwordModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      if (previewPasswordInput) previewPasswordInput.focus();
    }, 60);
  }

  function closePasswordModal() {
    if (!passwordModal) return;
    passwordModal.classList.remove('open');
    passwordModal.setAttribute('aria-hidden', 'true');
  }

  if (comingSoonLogoTop) {
    comingSoonLogoTop.addEventListener('click', openPasswordModal);
  }
  if (comingSoonLogoCenter) {
    comingSoonLogoCenter.addEventListener('click', openPasswordModal);
  }
  if (closePwModalBtn) {
    closePwModalBtn.addEventListener('click', closePasswordModal);
  }
  if (passwordModal) {
    passwordModal.addEventListener('click', (e) => {
      if (e.target === passwordModal) closePasswordModal();
    });
  }

  if (passwordUnlockForm) {
    passwordUnlockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = (previewPasswordInput ? previewPasswordInput.value : '').trim();
      if (entered.toLowerCase() === PREVIEW_PASSWORD_LOWER) {
        unlockSite();
        showToast('Preview unlocked. Welcome to The Azusa Network!');
      } else {
        if (pwErrorMsg) {
          pwErrorMsg.textContent = 'Incorrect password. Please enter Azusa123 to unlock.';
        }
      }
    });
  }

  lockSiteBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      lockSite();
      showToast('Returned to Coming Soon landing page. Click the logo to unlock again.');
    });
  });

  // Notify Me at Launch -> Sends to /api/webhook
  if (comingSoonNotifyForm) {
    comingSoonNotifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('notifyEmail');
      const emailVal = emailInput ? emailInput.value.trim() : '';
      if (!emailVal) {
        if (notifyFeedback) notifyFeedback.textContent = 'Please enter your email address.';
        return;
      }

      if (notifySubmitBtn) {
        notifySubmitBtn.disabled = true;
        notifySubmitBtn.textContent = 'Sending...';
      }

      await sendToWebhook({
        name: 'Launch Notification Subscriber',
        company: 'Azusa Network Launch List',
        email: emailVal,
        projectType: 'launch-notify',
        message: 'Requested launch notification on azusanetwork.com Coming Soon page.',
      });

      if (notifySubmitBtn) {
        notifySubmitBtn.disabled = false;
        notifySubmitBtn.textContent = 'Notify Me at Launch';
      }

      if (notifyFeedback) {
        notifyFeedback.textContent = `Thank you! ${emailVal} has been registered for launch updates.`;
      }
      comingSoonNotifyForm.reset();
    });
  }

  // =========================================================================
  // MAIN WEBSITE & MEMBER PORTAL LOGIC
  // =========================================================================
  const publicView = document.getElementById('publicView');
  const portalView = document.getElementById('portalView');
  const openPortalBtn = document.getElementById('openPortalBtn');
  const mobilePortalBtn = document.getElementById('mobilePortalBtn');
  const portalSwitchLabel = document.getElementById('portalSwitchLabel');
  const heroPreviewPortalBtn = document.getElementById('heroPreviewPortalBtn');
  const switchPublicBtns = document.querySelectorAll('[data-switch-public]');
  const publicNavLinks = document.querySelectorAll('[data-nav-public]');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const primaryNav = document.getElementById('primaryNav');

  // Segmented Billing Toggle
  const billingSegmentBtns = document.querySelectorAll('[data-billing-mode]');
  const priceAmounts = document.querySelectorAll('.plan-price .amount');
  const priceCaptions = document.querySelectorAll('.plan-billing-caption');

  // Custom Stewardship Slider
  const churchBudgetRange = document.getElementById('churchBudgetRange');
  const budgetOutput = document.getElementById('budgetOutput');
  const suggestedSeedOutput = document.getElementById('suggestedSeedOutput');
  const applyCustomSeedBtn = document.getElementById('applyCustomSeedBtn');

  // Multi-Step Inline Application Wizard & Payment References
  const applicationFlowSection = document.getElementById('applicationFlowSection');
  const subscriptionCheckoutForm = document.getElementById('subscriptionCheckoutForm');
  const modalTierInputs = document.querySelectorAll('input[name="selectedTier"]');
  const modalTotalAmount = document.getElementById('modalTotalAmount');
  const wizardHeaderPlanBadge = document.getElementById('wizardHeaderPlanBadge');
  const wizardStepTabs = document.querySelectorAll('[data-wizard-step]');
  const wizardPanes = document.querySelectorAll('[data-step-pane]');
  const wizardProgressFill = document.getElementById('wizardProgressFill');
  const wizardMobileStepText = document.getElementById('wizardMobileStepText');
  const wizardPrevBtn = document.getElementById('wizardPrevBtn');
  const wizardNextBtn = document.getElementById('wizardNextBtn');
  const appSubmitBtn = document.getElementById('appSubmitBtn');
  const payTabs = document.querySelectorAll('[data-pay-method]');
  const cardPaymentFields = document.getElementById('cardPaymentFields');
  const achPaymentFields = document.getElementById('achPaymentFields');

  // Toast
  const toastEl = document.getElementById('toastNotification');
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 4200);
  }

  // View Switching (Public Site <-> Member Portal)
  function setView(targetView) {
    state.activeView = targetView;
    if (targetView === 'portal') {
      publicView.classList.remove('active');
      portalView.classList.add('active');
      if (portalSwitchLabel) portalSwitchLabel.textContent = 'Back to Website';
      if (openPortalBtn) openPortalBtn.classList.add('active-portal');
      if (mobilePortalBtn) mobilePortalBtn.textContent = 'Back to Public Website';
    } else {
      portalView.classList.remove('active');
      publicView.classList.add('active');
      if (portalSwitchLabel) portalSwitchLabel.textContent = 'Member Portal';
      if (openPortalBtn) openPortalBtn.classList.remove('active-portal');
      if (mobilePortalBtn) mobilePortalBtn.textContent = 'Member Portal';
    }
    if (primaryNav) primaryNav.classList.remove('mobile-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (openPortalBtn) {
    openPortalBtn.addEventListener('click', () => {
      setView(state.activeView === 'portal' ? 'public' : 'portal');
    });
  }

  if (mobilePortalBtn) {
    mobilePortalBtn.addEventListener('click', () => {
      setView(state.activeView === 'portal' ? 'public' : 'portal');
    });
  }

  if (heroPreviewPortalBtn) {
    heroPreviewPortalBtn.addEventListener('click', () => {
      setView('portal');
    });
  }

  switchPublicBtns.forEach((btn) => {
    btn.addEventListener('click', () => setView('public'));
  });

  publicNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (state.activeView !== 'public') {
        setView('public');
      }
      if (primaryNav) primaryNav.classList.remove('mobile-open');
    });
  });

  if (mobileMenuBtn && primaryNav) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = primaryNav.classList.toggle('mobile-open');
      mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Billing Cadence Toggle (Monthly <-> Annual)
  function updateBillingPrices() {
    const isAnnual = state.billingCadence === 'annual';

    billingSegmentBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-billing-mode') === state.billingCadence);
    });

    priceAmounts.forEach((el) => {
      el.textContent = isAnnual ? el.getAttribute('data-annual') : el.getAttribute('data-monthly');
    });

    priceCaptions.forEach((el) => {
      el.textContent = isAnnual
        ? el.getAttribute('data-annual-note')
        : el.getAttribute('data-monthly-note');
    });

    Object.keys(TIER_CATALOG).forEach((key) => {
      const tier = TIER_CATALOG[key];
      const priceSpan = document.querySelector(`[data-modal-price="${key}"]`);
      if (priceSpan) {
        priceSpan.textContent = isAnnual ? `$${tier.annualTotal}/yr` : `$${tier.monthly}/mo`;
      }
    });

    updateModalTotalDisplay();
  }

  billingSegmentBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.billingCadence = btn.getAttribute('data-billing-mode');
      state.customAmount = null;
      updateBillingPrices();
    });
  });

  // Custom Church Stewardship Slider
  if (churchBudgetRange && budgetOutput && suggestedSeedOutput) {
    churchBudgetRange.addEventListener('input', () => {
      const budget = Number(churchBudgetRange.value);
      const suggested = Math.round(budget * 0.02);
      budgetOutput.textContent = `$${budget.toLocaleString()} / mo`;
      suggestedSeedOutput.textContent = `$${suggested.toLocaleString()} / month`;
    });
  }

  if (applyCustomSeedBtn && churchBudgetRange) {
    applyCustomSeedBtn.addEventListener('click', () => {
      const budget = Number(churchBudgetRange.value);
      const suggested = Math.round(budget * 0.02);
      state.customAmount = suggested;
      openSubscriptionModal('church', true);
    });
  }

  // Multi-Step Inline Application Wizard Logic
  const sigSelectedLevelInput = document.getElementById('sigSelectedLevel');
  const sigDateInput = document.getElementById('sigDate');
  const sectionChurchMinistry = document.getElementById('sectionChurchMinistry');
  const sectionMinisterialCredentials = document.getElementById('sectionMinisterialCredentials');
  const sec8SelectedPlanName = document.getElementById('sec8SelectedPlanName');
  const sec8SelectedPlanPrice = document.getElementById('sec8SelectedPlanPrice');
  const ccNumberInput = document.getElementById('ccNumber');
  const ccExpiryInput = document.getElementById('ccExpiry');
  const ccBrandBadge = document.getElementById('ccBrandBadge');

  const STEP_NAMES = {
    1: 'Select Affiliation Level',
    2: 'Applicant Profile',
    3: 'Ministry & Calling',
    4: 'Doctrine & Covenant',
    5: 'Payment & Submit',
  };

  let currentWizardStep = 1;
  let activePayMethod = 'card';

  if (sigDateInput && !sigDateInput.value) {
    sigDateInput.value = new Date().toISOString().split('T')[0];
  }

  function updateModalTotalDisplay() {
    const tierObj = TIER_CATALOG[state.selectedTier] || TIER_CATALOG.minister;
    const feeText = `$${tierObj.monthly}.00 / month`;
    if (modalTotalAmount) {
      modalTotalAmount.textContent = feeText;
    }
    if (wizardHeaderPlanBadge) {
      wizardHeaderPlanBadge.textContent = `${tierObj.name} · $${tierObj.monthly}.00/mo`;
    }
    if (sigSelectedLevelInput) {
      sigSelectedLevelInput.value = `${tierObj.name} — $${tierObj.monthly}.00/mo`;
    }
    if (sec8SelectedPlanName) {
      sec8SelectedPlanName.textContent = `${tierObj.name} Affiliation`;
    }
    if (sec8SelectedPlanPrice) {
      sec8SelectedPlanPrice.textContent = `$${tierObj.monthly}.00`;
    }
    if (sectionChurchMinistry) {
      sectionChurchMinistry.classList.toggle('section-highlighted', state.selectedTier === 'church');
    }
    if (sectionMinisterialCredentials) {
      sectionMinisterialCredentials.classList.toggle('section-highlighted', state.selectedTier === 'minister');
    }
  }

  function validateWizardStep(stepNum) {
    const val = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };
    const checked = (id) => {
      const el = document.getElementById(id);
      return el ? Boolean(el.checked) : false;
    };

    if (stepNum === 2) {
      if (!val('subFullName') || !val('subEmail') || !val('subPhone')) {
        showToast('Please enter your Full Legal Name, Email Address, and Telephone Number to continue.');
        const firstEmpty = ['subFullName', 'subEmail', 'subPhone']
          .map((id) => document.getElementById(id))
          .find((el) => el && !el.value.trim());
        if (firstEmpty) firstEmpty.focus();
        return false;
      }
      // Auto-populate signature & cardholder fields if blank
      const fullName = val('subFullName');
      const position = val('subPosition');
      const sigRepEl = document.getElementById('sigRepName');
      const sigTitleEl = document.getElementById('sigTitle');
      const ccNameEl = document.getElementById('ccName');
      const ccZipEl = document.getElementById('ccZip');
      if (sigRepEl && !sigRepEl.value.trim()) sigRepEl.value = fullName;
      if (sigTitleEl && !sigTitleEl.value.trim() && position) sigTitleEl.value = position;
      if (ccNameEl && !ccNameEl.value.trim()) ccNameEl.value = fullName;
      if (ccZipEl && !ccZipEl.value.trim() && val('subZip')) ccZipEl.value = val('subZip');
    }

    if (stepNum === 3) {
      if (!val('bgRelationshipChrist') || !val('bgWhyAncm')) {
        showToast('Please share your brief testimony and what led you to seek affiliation with ANCM.');
        const firstEmpty = ['bgRelationshipChrist', 'bgWhyAncm']
          .map((id) => document.getElementById(id))
          .find((el) => el && !el.value.trim());
        if (firstEmpty) firstEmpty.focus();
        return false;
      }
    }

    if (stepNum === 4) {
      const allDoctrinesAffirmed =
        checked('docAffirm1') &&
        checked('docAffirm2') &&
        checked('docAffirm3') &&
        checked('docAffirm4') &&
        checked('docAffirm5');
      if (!allDoctrinesAffirmed) {
        showToast('Please affirm all 5 foundational doctrinal statements in Step 4 to continue.');
        return false;
      }
    }

    return true;
  }

  function setWizardStep(targetStep, shouldScroll = true) {
    const step = Math.max(1, Math.min(5, Number(targetStep) || 1));

    // Validate intermediate steps when advancing forward
    if (step > currentWizardStep) {
      for (let s = currentWizardStep; s < step; s++) {
        if (!validateWizardStep(s)) return;
      }
    }

    currentWizardStep = step;

    wizardPanes.forEach((pane) => {
      const paneStep = Number(pane.getAttribute('data-step-pane'));
      pane.classList.toggle('active', paneStep === currentWizardStep);
    });

    wizardStepTabs.forEach((tab) => {
      const tabStep = Number(tab.getAttribute('data-wizard-step'));
      tab.classList.toggle('active', tabStep === currentWizardStep);
      tab.classList.toggle('completed', tabStep < currentWizardStep);
      tab.setAttribute('aria-selected', tabStep === currentWizardStep ? 'true' : 'false');
    });

    if (wizardProgressFill) {
      wizardProgressFill.style.width = `${currentWizardStep * 20}%`;
    }

    if (wizardMobileStepText) {
      wizardMobileStepText.textContent = `Step ${currentWizardStep} of 5 — ${STEP_NAMES[currentWizardStep]}`;
    }

    if (wizardPrevBtn) {
      wizardPrevBtn.style.display = currentWizardStep > 1 ? 'inline-flex' : 'none';
    }

    if (wizardNextBtn) {
      if (currentWizardStep < 5) {
        wizardNextBtn.style.display = 'inline-flex';
        wizardNextBtn.innerHTML = `Continue to Step ${currentWizardStep + 1}: ${STEP_NAMES[currentWizardStep + 1]} &rarr;`;
      } else {
        wizardNextBtn.style.display = 'none';
      }
    }

    if (appSubmitBtn) {
      appSubmitBtn.style.display = currentWizardStep === 5 ? 'inline-flex' : 'none';
    }

    if (shouldScroll && applicationFlowSection) {
      const rect = applicationFlowSection.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const offsetTop = rect.top + scrollTop - 92;
      window.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
    }
  }

  function openSubscriptionModal(tierKey, keepCustom = false, jumpToStep = 2) {
    if (!keepCustom) state.customAmount = null;
    state.selectedTier = tierKey || 'minister';

    // If not currently on the dedicated application page, navigate to /apply.html
    if (!subscriptionCheckoutForm) {
      window.location.href = `./apply.html?tier=${encodeURIComponent(state.selectedTier)}`;
      return;
    }

    modalTierInputs.forEach((input) => {
      input.checked = input.value === state.selectedTier;
    });

    updateModalTotalDisplay();
    setWizardStep(jumpToStep, true);
  }

  function closeSubscriptionModal() {
    setWizardStep(1, false);
  }

  // Auto-Save & Restore Draft Progress on Dedicated /apply.html Page
  const DRAFT_STORAGE_KEY = 'azusa_application_draft_v1';
  const draftSavedIndicator = document.getElementById('draftSavedIndicator');
  const DRAFT_FIELD_IDS = [
    'subFullName',
    'subPreferredName',
    'subEmail',
    'subPhone',
    'subAddress',
    'subCity',
    'subState',
    'subZip',
    'subOrg',
    'subPosition',
    'subWebsite',
    'orgLegalName',
    'orgPublicName',
    'orgYearEst',
    'orgPrimaryLeader',
    'orgAddress',
    'orgWebsite',
    'orgType',
    'orgSizeOrOther',
    'orgMissionDesc',
    'orgBoardApproval',
    'orgAuthRep',
    'orgAuthTitle',
    'credStanding',
    'credIssuingOrg',
    'credYearIssued',
    'credCurrentStatus',
    'credYearsMinistry',
    'bgRelationshipChrist',
    'bgWhyAncm',
    'bgHopingToReceive',
    'bgGiftsAndService',
    'bgOtherAffiliation',
    'bgOtherOrgName',
    'docQuestions',
    'sigRepName',
    'sigTitle',
    'sigElectronic',
  ];

  function saveApplicationDraft() {
    if (!subscriptionCheckoutForm) return;
    try {
      const fields = {};
      DRAFT_FIELD_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) fields[id] = el.value;
      });
      const draft = {
        selectedTier: state.selectedTier,
        step: currentWizardStep,
        fields,
        updatedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      if (draftSavedIndicator) {
        draftSavedIndicator.classList.add('pulsing');
        setTimeout(() => draftSavedIndicator.classList.remove('pulsing'), 800);
      }
    } catch (_) {}
  }

  function restoreApplicationDraft() {
    if (!subscriptionCheckoutForm) return;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.fields) {
          Object.entries(draft.fields).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el && val) el.value = val;
          });
        }
        if (draft && draft.selectedTier && TIER_CATALOG[draft.selectedTier]) {
          state.selectedTier = draft.selectedTier;
        }
        if (draft && draft.step) {
          currentWizardStep = Math.max(1, Math.min(5, Number(draft.step) || 1));
        }
      }
    } catch (_) {}

    // URL query param ?tier=... overrides tier selection and jumps to Step 2 if coming from a plan card
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTier = params.get('tier');
      if (urlTier && TIER_CATALOG[urlTier]) {
        state.selectedTier = urlTier;
        if (currentWizardStep === 1) {
          currentWizardStep = 2;
        }
      }
    } catch (_) {}

    modalTierInputs.forEach((input) => {
      input.checked = input.value === state.selectedTier;
    });

    updateModalTotalDisplay();
    setWizardStep(currentWizardStep, false);
  }

  if (subscriptionCheckoutForm) {
    restoreApplicationDraft();
    subscriptionCheckoutForm.addEventListener('input', saveApplicationDraft);
    subscriptionCheckoutForm.addEventListener('change', saveApplicationDraft);
  }

  wizardStepTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = Number(tab.getAttribute('data-wizard-step'));
      setWizardStep(target, true);
      saveApplicationDraft();
    });
  });

  if (wizardPrevBtn) {
    wizardPrevBtn.addEventListener('click', () => {
      if (currentWizardStep > 1) {
        setWizardStep(currentWizardStep - 1, true);
        saveApplicationDraft();
      }
    });
  }

  if (wizardNextBtn) {
    wizardNextBtn.addEventListener('click', () => {
      if (currentWizardStep < 5) {
        setWizardStep(currentWizardStep + 1, true);
        saveApplicationDraft();
      }
    });
  }

  document.querySelectorAll('[data-select-plan]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tier = btn.getAttribute('data-select-plan') || 'minister';
      if (subscriptionCheckoutForm) {
        e.preventDefault();
        openSubscriptionModal(tier, false, 2);
      }
    });
  });

  document.querySelectorAll('[data-open-modal="application"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tier = btn.getAttribute('data-tier') || 'minister';
      if (subscriptionCheckoutForm) {
        e.preventDefault();
        openSubscriptionModal(tier, false, 1);
      }
    });
  });

  const changePlanPortalBtn = document.getElementById('changePlanPortalBtn');
  if (changePlanPortalBtn) {
    changePlanPortalBtn.addEventListener('click', (e) => {
      if (subscriptionCheckoutForm) {
        e.preventDefault();
        openSubscriptionModal(state.subscriber.tier, false, 1);
      }
    });
  }

  modalTierInputs.forEach((input) => {
    input.addEventListener('change', () => {
      state.selectedTier = input.value;
      state.customAmount = null;
      updateModalTotalDisplay();
    });
  });

  // Payment Method Switcher inside Step 5
  payTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const method = tab.getAttribute('data-pay-method');
      activePayMethod = method || 'card';
      payTabs.forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      if (method === 'ach') {
        cardPaymentFields.classList.add('hidden');
        achPaymentFields.classList.remove('hidden');
      } else {
        achPaymentFields.classList.add('hidden');
        cardPaymentFields.classList.remove('hidden');
      }
    });
  });

  // Live Credit Card Number & Expiry Formatting for Mobile & Desktop
  if (ccNumberInput) {
    ccNumberInput.addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
      const groups = digits.match(/.{1,4}/g);
      e.target.value = groups ? groups.join(' ') : digits;

      if (ccBrandBadge) {
        if (/^4/.test(digits)) ccBrandBadge.textContent = 'VISA';
        else if (/^(5[1-5]|2[2-7])/.test(digits)) ccBrandBadge.textContent = 'MASTERCARD';
        else if (/^3[47]/.test(digits)) ccBrandBadge.textContent = 'AMEX';
        else if (/^6(?:011|5)/.test(digits)) ccBrandBadge.textContent = 'DISCOVER';
        else ccBrandBadge.textContent = 'CARD';
      }
    });
  }

  if (ccExpiryInput) {
    ccExpiryInput.addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) {
        e.target.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      } else {
        e.target.value = digits;
      }
    });
  }

  // Official Network Affiliation Application & Covenant Submission -> Sends to /api/webhook & Opens Portal
  if (subscriptionCheckoutForm) {
    subscriptionCheckoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (currentWizardStep < 5) {
        setWizardStep(currentWizardStep + 1, true);
        return;
      }

      const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
      };
      const checked = (id) => {
        const el = document.getElementById(id);
        return el ? Boolean(el.checked) : false;
      };

      const fullName = val('subFullName');
      const preferredName = val('subPreferredName');
      const email = val('subEmail');
      const phone = val('subPhone');
      const address = val('subAddress');
      const city = val('subCity');
      const st = val('subState');
      const zip = val('subZip');
      const org = val('subOrg');
      const position = val('subPosition');
      const website = val('subWebsite');

      // Section 3: Church or Ministry Info
      const orgLegalName = val('orgLegalName');
      const orgPublicName = val('orgPublicName');
      const orgYearEst = val('orgYearEst');
      const orgPrimaryLeader = val('orgPrimaryLeader');
      const orgAddress = val('orgAddress');
      const orgWebsite = val('orgWebsite');
      const orgType = val('orgType');
      const orgSizeOrOther = val('orgSizeOrOther');
      const orgMissionDesc = val('orgMissionDesc');
      const orgBoardApproval = val('orgBoardApproval');
      const orgAuthRep = val('orgAuthRep');
      const orgAuthTitle = val('orgAuthTitle');

      // Section 4: Spiritual Background
      const bgRelationshipChrist = val('bgRelationshipChrist');
      const bgWhyAncm = val('bgWhyAncm');
      const bgHopingToReceive = val('bgHopingToReceive');
      const bgGiftsAndService = val('bgGiftsAndService');
      const bgOtherAffiliation = val('bgOtherAffiliation');
      const bgOtherOrgName = val('bgOtherOrgName');

      // Section 5: Doctrinal Alignment
      const docQuestions = val('docQuestions');
      const allDoctrinesAffirmed =
        checked('docAffirm1') &&
        checked('docAffirm2') &&
        checked('docAffirm3') &&
        checked('docAffirm4') &&
        checked('docAffirm5');

      // Section 6: Ministerial Credentials
      const credStanding = val('credStanding');
      const credIssuingOrg = val('credIssuingOrg');
      const credYearIssued = val('credYearIssued');
      const credCurrentStatus = val('credCurrentStatus');
      const credYearsMinistry = val('credYearsMinistry');

      // Step 5: Payment & Signature
      const billingAuthAgree = checked('billingAuthAgree');
      const covenantAgree = checked('covenantAgree');
      const sigRepName = val('sigRepName') || fullName;
      const sigTitle = val('sigTitle') || position;
      const sigElectronic = val('sigElectronic') || fullName;
      const sigDate = val('sigDate') || new Date().toISOString().split('T')[0];

      if (!fullName || !email || !phone) {
        setWizardStep(2, true);
        showToast('Please enter your Full Legal Name, Email Address, and Telephone Number in Step 2.');
        return;
      }

      if (activePayMethod === 'card') {
        const ccNumDigits = val('ccNumber').replace(/\D/g, '');
        if (ccNumDigits.length < 13 || !val('ccExpiry') || !val('ccCvc')) {
          showToast('Please enter your complete credit card number, expiration date, and security code (CVC).');
          if (ccNumberInput) ccNumberInput.focus();
          return;
        }
      } else {
        if (!val('achRouting') || !val('achAccount')) {
          showToast('Please enter your bank routing and account numbers for ACH billing.');
          return;
        }
      }

      if (!allDoctrinesAffirmed || !billingAuthAgree || !covenantAgree) {
        showToast('Please affirm Doctrinal Alignment, Recurring Billing Authorization, and Applicant Affirmation.');
        return;
      }

      const tierInfo = TIER_CATALOG[state.selectedTier] || TIER_CATALOG.minister;
      const rateString = `$${tierInfo.monthly}.00 / month`;
      const memberId = `ANCM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const companyName = org || orgPublicName || orgLegalName || 'Azusa Partner Ministry';
      const maskedPaymentSummary =
        activePayMethod === 'card'
          ? `Credit Card (${ccBrandBadge ? ccBrandBadge.textContent : 'CARD'} ending in ${val('ccNumber').replace(/\D/g, '').slice(-4) || 'XXXX'})`
          : `US Bank ACH (${val('achAccountType')} ending in ${val('achAccount').replace(/\D/g, '').slice(-4) || 'XXXX'})`;

      state.subscriber = {
        name: fullName,
        email: email,
        org: companyName,
        tier: state.selectedTier,
        memberId,
      };

      if (appSubmitBtn) {
        appSubmitBtn.disabled = true;
        appSubmitBtn.textContent = 'Processing Application & Payment...';
      }

      const detailedMessage = [
        `=== ANCM NETWORK AFFILIATION APPLICATION (${memberId}) ===`,
        `[STEP 1 — AFFILIATION LEVEL]: ${tierInfo.name} (${rateString})`,
        `[STEP 2 — APPLICANT INFO]: Name: ${fullName} (Preferred: ${preferredName || 'N/A'}) | Email: ${email} | Phone: ${phone} | Address: ${address}, ${city}, ${st} ${zip} | Church/Ministry: ${companyName} | Position: ${position || 'N/A'} | Web/Social: ${website || 'N/A'}`,
        `[STEP 3 — CHURCH/MINISTRY & CREDENTIALS]: Legal Name: ${orgLegalName || 'N/A'} | Public Name: ${orgPublicName || 'N/A'} | Est: ${orgYearEst || 'N/A'} | Leader: ${orgPrimaryLeader || 'N/A'} | Type: ${orgType || 'N/A'} (${orgSizeOrOther || 'N/A'}) | Mission: ${orgMissionDesc || 'N/A'} | Leadership Approved: ${orgBoardApproval || 'N/A'} (${orgAuthRep || 'N/A'}, ${orgAuthTitle || 'N/A'}) | Standing: ${credStanding || 'N/A'} | Issuing Org: ${credIssuingOrg || 'N/A'} (${credYearIssued || 'N/A'}) | Active Years: ${credYearsMinistry || 'N/A'}`,
        `[STEP 3 — SPIRITUAL BACKGROUND]: (1) Testimony/Ministry: ${bgRelationshipChrist || 'N/A'} | (2) Why ANCM: ${bgWhyAncm || 'N/A'} | (3) Hoping to Receive: ${bgHopingToReceive || 'N/A'} | (4) Gifts/Service: ${bgGiftsAndService || 'N/A'} | (5) Other Affiliation: ${bgOtherAffiliation} (${bgOtherOrgName || 'None'})`,
        `[STEP 4 — DOCTRINAL ALIGNMENT]: All 5 ANCM Doctrinal Statements Affirmed: Yes | Doctrinal Questions: ${docQuestions || 'None'}`,
        `[STEP 5 — PAYMENT, COVENANT & SIGNATURE]: Payment Method: ${maskedPaymentSummary} | Representative: ${sigRepName} (${sigTitle || 'N/A'}) | Signature: ${sigElectronic} | Date: ${sigDate}`,
      ].join('\n');

      await sendToWebhook({
        name: fullName,
        company: companyName,
        email,
        projectType: `${tierInfo.name} ($${tierInfo.monthly}.00/mo)`,
        message: detailedMessage,
      });

      // Attempt Stripe Recurring Checkout Session creation if STRIPE_SECRET_KEY is configured in Vercel
      try {
        const stripeRes = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier: state.selectedTier,
            name: fullName,
            company: companyName,
            email,
            applicationId: memberId,
          }),
        });
        if (stripeRes.ok) {
          const stripeData = await stripeRes.json();
          if (stripeData && stripeData.stripeConfigured && stripeData.checkoutUrl) {
            window.location.href = stripeData.checkoutUrl;
            return;
          }
        }
      } catch (_) {}

      if (appSubmitBtn) {
        appSubmitBtn.disabled = false;
        appSubmitBtn.textContent = 'Complete Application & Activate Affiliation';
      }

      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        localStorage.setItem('azusa_subscriber_profile', JSON.stringify({
          ...state.subscriber,
          maskedPaymentSummary,
        }));
      } catch (_) {}

      // If submitted from the dedicated /apply.html page, redirect to index.html Member Portal
      if (!portalView) {
        window.location.href = `./index.html?checkout=success&tier=${encodeURIComponent(state.selectedTier)}&app_id=${encodeURIComponent(memberId)}`;
        return;
      }

      const portalTierBadge = document.getElementById('portalTierBadge');
      if (portalTierBadge) portalTierBadge.textContent = tierInfo.shortBadge;

      const portalWelcomeTitle = document.getElementById('portalWelcomeTitle');
      if (portalWelcomeTitle) portalWelcomeTitle.textContent = `Welcome, ${fullName}`;

      const memberCardName = document.getElementById('memberCardName');
      if (memberCardName) memberCardName.textContent = `${fullName} · ${state.subscriber.org}`;

      const memberCardPlan = document.getElementById('memberCardPlan');
      if (memberCardPlan) memberCardPlan.textContent = `${tierInfo.name} (${rateString})`;

      const memberIdCode = document.getElementById('memberIdCode');
      if (memberIdCode) memberIdCode.textContent = state.subscriber.memberId;

      const billingPlanTitle = document.getElementById('billingPlanTitle');
      if (billingPlanTitle) billingPlanTitle.textContent = tierInfo.name;

      const billingPlanRate = document.getElementById('billingPlanRate');
      if (billingPlanRate) {
        billingPlanRate.textContent = `${rateString} · ${maskedPaymentSummary} (${state.subscriber.org})`;
      }

      closeSubscriptionModal();
      setView('portal');
      showToast(`Affiliation Application (${memberId}) & payment submitted for ${fullName}!`);
    });
  }

  // Portal Sub-navigation Tabs
  const portalNavBtns = document.querySelectorAll('[data-portal-tab]');
  const portalPanels = document.querySelectorAll('.portal-tab-panel');

  portalNavBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-portal-tab');
      portalNavBtns.forEach((b) => b.classList.toggle('active', b === btn));
      portalPanels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === `portal-tab-${target}`);
      });
    });
  });

  // Resource Vault Category Filter
  const filterPills = document.querySelectorAll('[data-filter-res]');
  const resourceItems = document.querySelectorAll('[data-res-cat]');

  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const cat = pill.getAttribute('data-filter-res');
      filterPills.forEach((p) => p.classList.toggle('active', p === pill));
      resourceItems.forEach((item) => {
        const matches = cat === 'all' || item.getAttribute('data-res-cat') === cat;
        item.classList.toggle('hidden', !matches);
      });
    });
  });

  // Event RSVP Buttons
  document.querySelectorAll('[data-rsvp-event]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eventName = btn.getAttribute('data-rsvp-event');
      btn.textContent = 'Spot Reserved';
      btn.classList.remove('btn-outline-navy');
      btn.classList.add('btn-navy');
      showToast(`Registered for "${eventName}". Details sent to your email.`);
    });
  });

  // Generic Toast Action Buttons in Portal
  document.querySelectorAll('[data-toast]').forEach((btn) => {
    btn.addEventListener('click', () => {
      showToast(btn.getAttribute('data-toast'));
    });
  });

  // Direct Contact Form -> Sends to /api/webhook
  const contactForm = document.getElementById('contactForm');
  const contactFeedback = document.getElementById('contactFeedback');
  const contactSubmitBtn = document.getElementById('contactSubmitBtn');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const ministry = document.getElementById('contactMinistry').value.trim();
      const topic = document.getElementById('contactTopic').value;
      const message = document.getElementById('contactMessage').value.trim();
      const newsletter = document.getElementById('contactNewsletter').checked;

      if (!name || !email) {
        if (contactFeedback) {
          contactFeedback.textContent = 'Please provide both your name and email address.';
        }
        return;
      }

      if (contactSubmitBtn) {
        contactSubmitBtn.disabled = true;
        contactSubmitBtn.textContent = 'Sending...';
      }

      await sendToWebhook({
        name,
        company: ministry || 'Independent Ministry',
        email,
        projectType: topic,
        message: newsletter ? `${message} (Opted into newsletter)` : message,
      });

      if (contactSubmitBtn) {
        contactSubmitBtn.disabled = false;
        contactSubmitBtn.textContent = 'Send Message';
      }

      if (contactFeedback) {
        contactFeedback.textContent = `Thank you, ${name}. Your message has been received by our leadership team.`;
      }
      showToast(`Message received from ${name}. Our leadership team will be in touch soon.`);
      contactForm.reset();
    });
  }

  // Webhook Configuration & Test Form inside Member Portal
  const webhookConfigForm = document.getElementById('webhookConfigForm');
  const customWebhookInput = document.getElementById('customWebhookInput');
  const webhookStatusOutput = document.getElementById('webhookStatusOutput');

  if (customWebhookInput) {
    try {
      customWebhookInput.value = localStorage.getItem(STORAGE_WEBHOOK_KEY) || '';
    } catch (_) {}
  }

  if (webhookConfigForm) {
    webhookConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const urlVal = customWebhookInput ? customWebhookInput.value.trim() : '';
      try {
        if (urlVal) {
          localStorage.setItem(STORAGE_WEBHOOK_KEY, urlVal);
        } else {
          localStorage.removeItem(STORAGE_WEBHOOK_KEY);
        }
      } catch (_) {}

      if (webhookStatusOutput) {
        webhookStatusOutput.textContent = 'Sending test webhook payload...';
      }

      const result = await sendToWebhook({
        name: 'Azusa Network Test',
        company: 'The Azusa Network',
        email: 'test@azusanetwork.com',
        projectType: 'webhook-test',
        message: 'Test webhook delivery from The Azusa Network platform',
        webhookUrl: urlVal,
      });

      if (webhookStatusOutput) {
        if (result && result.forwarded) {
          webhookStatusOutput.textContent = `Webhook saved and test payload delivered (HTTP ${result.webhookStatus}).`;
        } else if (urlVal) {
          webhookStatusOutput.textContent = `Webhook URL saved locally. Endpoint response: ${result.webhookStatus || result.error || 'received'}.`;
        } else {
          webhookStatusOutput.textContent = 'Local webhook override cleared (using server WEBHOOK_URL if set).';
        }
      }
    });
  }

  // Cookie & Privacy Consent Banner Logic
  const COOKIE_CONSENT_KEY = 'azusa_cookie_consent_v1';
  const cookieConsentBanner = document.getElementById('cookieConsentBanner');
  const cookieAcceptBtn = document.getElementById('cookieAcceptBtn');
  const cookieEssentialBtn = document.getElementById('cookieEssentialBtn');

  try {
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!savedConsent && cookieConsentBanner) {
      cookieConsentBanner.classList.remove('hidden');
    }
  } catch (_) {}

  function setCookieConsent(choice) {
    try {
      localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({ choice, timestamp: new Date().toISOString() })
      );
    } catch (_) {}
    if (cookieConsentBanner) {
      cookieConsentBanner.classList.add('hidden');
    }
  }

  if (cookieAcceptBtn) {
    cookieAcceptBtn.addEventListener('click', () => setCookieConsent('all'));
  }
  if (cookieEssentialBtn) {
    cookieEssentialBtn.addEventListener('click', () => setCookieConsent('essential'));
  }

  // Restore saved subscriber profile in Member Portal if present
  try {
    const savedProfileRaw = localStorage.getItem('azusa_subscriber_profile');
    if (savedProfileRaw) {
      const savedProfile = JSON.parse(savedProfileRaw);
      if (savedProfile && savedProfile.name) {
        state.subscriber = savedProfile;
        const tierInfo = TIER_CATALOG[savedProfile.tier] || TIER_CATALOG.minister;
        const rateString = `$${tierInfo.monthly}.00 / month`;
        const portalTierBadge = document.getElementById('portalTierBadge');
        if (portalTierBadge) portalTierBadge.textContent = tierInfo.shortBadge;
        const portalWelcomeTitle = document.getElementById('portalWelcomeTitle');
        if (portalWelcomeTitle) portalWelcomeTitle.textContent = `Welcome, ${savedProfile.name}`;
        const memberCardName = document.getElementById('memberCardName');
        if (memberCardName) memberCardName.textContent = `${savedProfile.name} · ${savedProfile.org}`;
        const memberCardPlan = document.getElementById('memberCardPlan');
        if (memberCardPlan) memberCardPlan.textContent = `${tierInfo.name} (${rateString})`;
        const memberIdCode = document.getElementById('memberIdCode');
        if (memberIdCode) memberIdCode.textContent = savedProfile.memberId;
        const billingPlanTitle = document.getElementById('billingPlanTitle');
        if (billingPlanTitle) billingPlanTitle.textContent = tierInfo.name;
        const billingPlanRate = document.getElementById('billingPlanRate');
        if (billingPlanRate) {
          billingPlanRate.textContent = `${rateString} · ${savedProfile.maskedPaymentSummary || 'Active Standing'} (${savedProfile.org})`;
        }
      }
    }
  } catch (_) {}

  // Handle return from Application Page or Stripe Checkout (?checkout=success or ?checkout=canceled)
  try {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const returnedTier = params.get('tier');
    const returnedAppId = params.get('app_id');
    if (checkoutStatus === 'success') {
      unlockSite();
      if (returnedTier && TIER_CATALOG[returnedTier]) {
        state.selectedTier = returnedTier;
        const tierInfo = TIER_CATALOG[returnedTier];
        const portalTierBadge = document.getElementById('portalTierBadge');
        if (portalTierBadge) portalTierBadge.textContent = tierInfo.shortBadge;
      }
      setView('portal');
      showToast(
        `Application & payment confirmed${returnedAppId ? ` (${returnedAppId})` : ''}! Welcome to The Azusa Network.`
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (checkoutStatus === 'canceled') {
      unlockSite();
      showToast('Checkout canceled. Your application was received and you can complete payment anytime.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (_) {}
})();
