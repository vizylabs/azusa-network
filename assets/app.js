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
      name: 'Associate Leader Membership',
      shortBadge: 'Associate Leader Membership · Active',
      monthly: 29,
      annualPerMonth: 24,
      annualTotal: 290,
    },
    minister: {
      name: 'Credentialed Minister Membership',
      shortBadge: 'Credentialed Minister Membership · Active',
      monthly: 59,
      annualPerMonth: 49,
      annualTotal: 590,
    },
    church: {
      name: 'Affiliated Church & Ministry',
      shortBadge: 'Affiliated Church & Ministry · Active',
      monthly: 149,
      annualPerMonth: 124,
      annualTotal: 1490,
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

  // Modal References
  const subscriptionModal = document.getElementById('subscriptionModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const subscriptionCheckoutForm = document.getElementById('subscriptionCheckoutForm');
  const modalTierInputs = document.querySelectorAll('input[name="selectedTier"]');
  const modalTotalAmount = document.getElementById('modalTotalAmount');
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

  // Subscription Modal Opening & Closing
  function updateModalTotalDisplay() {
    if (!modalTotalAmount) return;
    if (state.customAmount && state.selectedTier === 'church') {
      modalTotalAmount.textContent = `$${state.customAmount}.00 / month (2% Church Tithe Partnership)`;
      return;
    }
    const tierObj = TIER_CATALOG[state.selectedTier] || TIER_CATALOG.minister;
    if (state.billingCadence === 'annual') {
      modalTotalAmount.textContent = `$${tierObj.annualTotal.toLocaleString()}.00 / year`;
    } else {
      modalTotalAmount.textContent = `$${tierObj.monthly}.00 / month`;
    }
  }

  function openSubscriptionModal(tierKey, keepCustom = false) {
    if (!keepCustom) state.customAmount = null;
    state.selectedTier = tierKey || 'minister';

    modalTierInputs.forEach((input) => {
      input.checked = input.value === state.selectedTier;
    });

    updateModalTotalDisplay();
    subscriptionModal.classList.add('open');
    subscriptionModal.setAttribute('aria-hidden', 'false');
  }

  function closeSubscriptionModal() {
    subscriptionModal.classList.remove('open');
    subscriptionModal.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('[data-select-plan]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openSubscriptionModal(btn.getAttribute('data-select-plan'));
    });
  });

  document.querySelectorAll('[data-open-modal="application"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openSubscriptionModal(btn.getAttribute('data-tier') || 'minister');
    });
  });

  const changePlanPortalBtn = document.getElementById('changePlanPortalBtn');
  if (changePlanPortalBtn) {
    changePlanPortalBtn.addEventListener('click', () => {
      openSubscriptionModal(state.subscriber.tier);
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeSubscriptionModal);
  }

  if (subscriptionModal) {
    subscriptionModal.addEventListener('click', (e) => {
      if (e.target === subscriptionModal) closeSubscriptionModal();
    });
  }

  modalTierInputs.forEach((input) => {
    input.addEventListener('change', () => {
      state.selectedTier = input.value;
      state.customAmount = null;
      updateModalTotalDisplay();
    });
  });

  // Payment Method Switcher inside Modal
  payTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const method = tab.getAttribute('data-pay-method');
      payTabs.forEach((t) => t.classList.toggle('active', t === tab));
      if (method === 'ach') {
        cardPaymentFields.classList.add('hidden');
        achPaymentFields.classList.remove('hidden');
      } else {
        achPaymentFields.classList.add('hidden');
        cardPaymentFields.classList.remove('hidden');
      }
    });
  });

  // Checkout Submission -> Sends to /api/webhook & Opens Portal
  if (subscriptionCheckoutForm) {
    subscriptionCheckoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('subFullName').value.trim();
      const email = document.getElementById('subEmail').value.trim();
      const org = document.getElementById('subOrg').value.trim();
      const city = document.getElementById('subCity').value.trim();

      if (!fullName || !email) {
        showToast('Please enter your name and email address to complete your membership.');
        return;
      }

      const tierInfo = TIER_CATALOG[state.selectedTier] || TIER_CATALOG.minister;
      const rateString = state.customAmount
        ? `$${state.customAmount}/mo (Custom Church Seed)`
        : state.billingCadence === 'annual'
        ? `$${tierInfo.annualTotal}/yr`
        : `$${tierInfo.monthly}/mo`;

      const memberId = `AZN-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      state.subscriber = {
        name: fullName,
        email: email,
        org: org || 'Azusa Partner Ministry',
        tier: state.selectedTier,
        memberId,
      };

      await sendToWebhook({
        name: fullName,
        company: state.subscriber.org,
        email,
        projectType: `membership-${state.selectedTier}`,
        message: `New ${tierInfo.name} membership (${rateString}) | City: ${city || 'N/A'} | Member ID: ${memberId}`,
      });

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
        billingPlanRate.textContent = `${rateString} · Active Standing (${state.subscriber.org})`;
      }

      closeSubscriptionModal();
      setView('portal');
      showToast(`Membership activated for ${fullName}. Welcome to The Azusa Network!`);
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
})();
