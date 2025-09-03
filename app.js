class CheckoutModal {
  constructor() {
    this.currentStep = 1;
    this.phoneNumber = '';
    this.otpVerified = false;
    this.cart = null;
    this.addresses = this.getSavedAddresses();
    this.selectedAddressId = null;
    this.selectedPaymentMethod = null;
    this.discountCode = '';
    this.resendTimer = null;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.setupOTPInputs();
    this.prefillLastUsedSelections();
    this.loadCart();
    
    // Setup focus trap
    this.setupFocusTrap();
  }

  bindEvents() {
    // Modal controls
    document.getElementById('open-checkout').addEventListener('click', () => this.openModal());
    document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
    document.querySelector('.at-modal-backdrop').addEventListener('click', () => this.closeModal());
    
    // Step 1: Phone
    document.getElementById('phone-form').addEventListener('submit', (e) => this.handlePhoneSubmit(e));
    document.getElementById('phone-input').addEventListener('input', (e) => this.validatePhone(e));
    
    // Step 2: OTP
    document.getElementById('otp-form').addEventListener('submit', (e) => this.handleOTPSubmit(e));
    document.getElementById('resend-otp').addEventListener('click', () => this.handleResendOTP());
    
    // Step 3: Checkout
    document.getElementById('add-address-btn').addEventListener('click', () => this.toggleAddressForm());
    document.getElementById('cancel-address').addEventListener('click', () => this.hideAddressForm());
    document.getElementById('discount-form').addEventListener('submit', (e) => this.handleDiscountSubmit(e));
    document.getElementById('place-order').addEventListener('click', () => this.handlePlaceOrder());
    
    // Payment method changes
    document.addEventListener('change', (e) => {
      if (e.target.name === 'payment') {
        this.handlePaymentChange(e.target.value);
      }
      if (e.target.name === 'address') {
        this.handleAddressChange(e.target.value);
      }
    });
    
    // Address form submission
    document.querySelector('#add-address-form form').addEventListener('submit', (e) => this.handleAddressSubmit(e));
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('checkout-modal').hidden) {
        this.closeModal();
      }
    });
  }

  setupOTPInputs() {
    const otpInputs = document.querySelectorAll('.at-otp-input');
    
    otpInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = value;
        
        if (value && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
        
        if (value) {
          e.target.classList.add('at-filled');
        } else {
          e.target.classList.remove('at-filled');
        }
        
        this.validateOTPInputs();
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          otpInputs[index - 1].focus();
        }
      });
      
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
        
        for (let i = 0; i < Math.min(pastedData.length, otpInputs.length - index); i++) {
          if (otpInputs[index + i]) {
            otpInputs[index + i].value = pastedData[i];
            otpInputs[index + i].classList.add('at-filled');
          }
        }
        
        this.validateOTPInputs();
      });
    });
  }

  setupFocusTrap() {
    const modal = document.getElementById('checkout-modal');
    const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusable = modal.querySelectorAll(focusableElements);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    });
  }

  openModal() {
    const modal = document.getElementById('checkout-modal');
    modal.hidden = false;
    
    // Focus first input
    const firstInput = modal.querySelector('input');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
    
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    const modal = document.getElementById('checkout-modal');
    modal.hidden = true;
    document.body.style.overflow = '';
    
    // Reset to step 1
    this.goToStep(1);
    this.resetForm();
  }

  resetForm() {
    // Clear phone
    document.getElementById('phone-input').value = '';
    
    // Clear OTP
    document.querySelectorAll('.at-otp-input').forEach(input => {
      input.value = '';
      input.classList.remove('at-filled');
    });
    
    // Reset verification state
    this.otpVerified = false;
    this.updateStepAccess();
    
    // Clear errors
    document.querySelectorAll('.at-error').forEach(error => error.textContent = '');
    document.querySelectorAll('.at-message').forEach(msg => msg.textContent = '');
  }

  goToStep(step) {
    // Update progress
    const progressSteps = document.querySelectorAll('.at-progress-step');
    const steps = document.querySelectorAll('.at-step');
    
    progressSteps.forEach((stepEl, index) => {
      stepEl.classList.remove('at-active', 'at-completed');
      if (index + 1 === step) {
        stepEl.classList.add('at-active');
      } else if (index + 1 < step) {
        stepEl.classList.add('at-completed');
      }
    });
    
    // Update step content
    steps.forEach((stepEl, index) => {
      stepEl.classList.remove('at-active');
      if (index + 1 === step) {
        stepEl.classList.add('at-active');
      }
    });
    
    // Update progress bar aria
    document.querySelector('.at-progress').setAttribute('aria-valuenow', step);
    
    this.currentStep = step;
    this.updateStepAccess();
  }

  updateStepAccess() {
    // Step 3 is only accessible after OTP verification
    const step3 = document.getElementById('step-3');
    if (!this.otpVerified) {
      step3.style.opacity = '0.5';
      step3.style.pointerEvents = 'none';
    } else {
      step3.style.opacity = '1';
      step3.style.pointerEvents = 'auto';
    }
  }

  // Step 1: Phone Verification
  async handlePhoneSubmit(e) {
    e.preventDefault();
    
    const phoneInput = document.getElementById('phone-input');
    const phone = phoneInput.value.trim();
    
    if (!this.validatePhoneNumber(phone)) {
      return;
    }
    
    const btn = document.getElementById('send-otp');
    this.setButtonLoading(btn, true);
    
    try {
      await this.sendOtp(phone);
      this.phoneNumber = phone;
      document.getElementById('phone-display').textContent = `+91 ${phone}`;
      this.goToStep(2);
      this.showStatus('OTP sent successfully!');
    } catch (error) {
      this.showError('phone-error', 'Failed to send OTP. Please try again.');
    } finally {
      this.setButtonLoading(btn, false);
    }
  }

  validatePhoneNumber(phone) {
    const phoneError = document.getElementById('phone-error');
    phoneError.textContent = '';
    
    if (!phone) {
      phoneError.textContent = 'Phone number is required';
      return false;
    }
    
    if (!/^[6-9]\d{9}$/.test(phone)) {
      phoneError.textContent = 'Please enter a valid Indian phone number';
      return false;
    }
    
    return true;
  }

  validatePhone(e) {
    const input = e.target;
    input.value = input.value.replace(/[^0-9]/g, '');
    
    if (input.value.length > 10) {
      input.value = input.value.slice(0, 10);
    }
  }

  // Mock OTP function - TODO: Replace with real API
  async sendOtp(phone) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Mock API call
        if (Math.random() > 0.1) { // 90% success rate
          resolve({ success: true });
        } else {
          reject(new Error('Failed to send OTP'));
        }
      }, 1500);
    });
  }

  // Step 2: OTP Verification
  async handleOTPSubmit(e) {
    e.preventDefault();
    
    const otp = this.getOTPValue();
    
    if (!this.validateOTP(otp)) {
      return;
    }
    
    const btn = document.getElementById('verify-otp');
    this.setButtonLoading(btn, true);
    
    try {
      await this.verifyOtp(this.phoneNumber, otp);
      this.otpVerified = true;
      this.goToStep(3);
      this.showStatus('Phone verified successfully!');
      this.renderAddresses();
    } catch (error) {
      this.showError('otp-error', 'Invalid OTP. Please try again.');
      this.clearOTPInputs();
    } finally {
      this.setButtonLoading(btn, false);
    }
  }

  getOTPValue() {
    return Array.from(document.querySelectorAll('.at-otp-input'))
      .map(input => input.value)
      .join('');
  }

  validateOTP(otp) {
    const otpError = document.getElementById('otp-error');
    otpError.textContent = '';
    
    if (otp.length !== 4) {
      otpError.textContent = 'Please enter complete 4-digit OTP';
      return false;
    }
    
    if (!/^\d{4}$/.test(otp)) {
      otpError.textContent = 'OTP must contain only numbers';
      return false;
    }
    
    return true;
  }

  validateOTPInputs() {
    const otp = this.getOTPValue();
    const verifyBtn = document.getElementById('verify-otp');
    
    if (otp.length === 4) {
      verifyBtn.disabled = false;
    } else {
      verifyBtn.disabled = true;
    }
  }

  clearOTPInputs() {
    document.querySelectorAll('.at-otp-input').forEach(input => {
      input.value = '';
      input.classList.remove('at-filled');
    });
    this.validateOTPInputs();
  }

  // Mock OTP verification - TODO: Replace with real API
  async verifyOtp(phone, otp) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Mock verification - accept 1234 as valid OTP
        if (otp === '1234') {
          resolve({ success: true });
        } else {
          reject(new Error('Invalid OTP'));
        }
      }, 1000);
    });
  }

  async handleResendOTP() {
    try {
      await this.sendOtp(this.phoneNumber);
      this.showStatus('OTP resent successfully!');
      this.startResendTimer(30);
    } catch (error) {
      this.showError('otp-error', 'Failed to resend OTP');
    }
  }

  startResendTimer(seconds) {
    const btn = document.getElementById('resend-otp');
    const timer = document.getElementById('resend-timer');
    let timeLeft = seconds;
    
    btn.disabled = true;
    btn.textContent = `Resend OTP in ${timeLeft}s`;
    
    this.resendTimer = setInterval(() => {
      timeLeft--;
      timer.textContent = timeLeft;
      
      if (timeLeft <= 0) {
        clearInterval(this.resendTimer);
        btn.disabled = false;
        btn.innerHTML = '<span class="at-resend-text">Resend OTP</span>';
      }
    }, 1000);
  }

  // Cart Management
  async loadCart() {
    try {
      const response = await fetch('/cart.js');
      this.cart = await response.json();
      this.renderCart(this.cart);
    } catch (error) {
      // Mock cart data for demo
      this.cart = {
        items: [
          {
            id: 1,
            title: 'Sample Product',
            variant_title: 'Medium / Blue',
            quantity: 2,
            price: 2999,
            line_price: 5998,
            image: 'https://images.pexels.com/photos/267301/pexels-photo-267301.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
            url: '/products/sample'
          }
        ],
        total_price: 5998,
        items_count: 2
      };
      this.renderCart(this.cart);
    }
  }

  renderCart(cart) {
    const cartItems = document.getElementById('cart-items');
    const cartEmpty = document.getElementById('cart-empty');
    const cartSubtotal = document.getElementById('cart-subtotal');
    
    if (!cart.items || cart.items.length === 0) {
      cartItems.innerHTML = '';
      cartEmpty.hidden = false;
      document.getElementById('place-order').disabled = true;
      return;
    }
    
    cartEmpty.hidden = true;
    cartItems.innerHTML = '';
    
    cart.items.forEach(item => {
      const template = document.getElementById('cart-item-template');
      const cartItem = template.content.cloneNode(true);
      
      cartItem.querySelector('.at-item-image').src = item.image || 'https://images.pexels.com/photos/267301/pexels-photo-267301.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop';
      cartItem.querySelector('.at-item-image').alt = item.title;
      cartItem.querySelector('.at-item-title').textContent = item.title;
      cartItem.querySelector('.at-item-variant').textContent = item.variant_title || '';
      cartItem.querySelector('.at-item-qty').textContent = `Qty: ${item.quantity}`;
      cartItem.querySelector('.at-item-price').textContent = this.formatPrice(item.line_price);
      
      cartItems.appendChild(cartItem);
    });
    
    cartSubtotal.textContent = this.formatPrice(cart.total_price);
  }

  formatPrice(cents) {
    return `₹${(cents / 100).toFixed(2)}`;
  }

  // Address Management
  renderAddresses() {
    const container = document.getElementById('saved-addresses');
    container.innerHTML = '';
    
    if (this.addresses.length === 0) {
      this.showAddressForm();
      return;
    }
    
    this.addresses.forEach(address => {
      const template = document.getElementById('address-card-template');
      const addressCard = template.content.cloneNode(true);
      const radio = addressCard.querySelector('.at-address-radio');
      
      radio.value = address.id;
      radio.checked = address.id === this.selectedAddressId;
      
      addressCard.querySelector('.at-address-name').textContent = address.name;
      addressCard.querySelector('.at-address-line').textContent = address.address;
      addressCard.querySelector('.at-address-location').textContent = 
        `${address.city}, ${address.state} ${address.pincode}`;
      
      // Edit functionality
      const editBtn = addressCard.querySelector('.at-address-edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editAddress(address);
      });
      
      container.appendChild(addressCard);
    });
    
    this.updatePlaceOrderState();
  }

  getSavedAddresses() {
    try {
      const saved = localStorage.getItem('at_saved_addresses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveAddress(address) {
    if (!address.id) {
      address.id = 'addr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    const existingIndex = this.addresses.findIndex(a => a.id === address.id);
    if (existingIndex !== -1) {
      this.addresses[existingIndex] = address;
    } else {
      this.addresses.push(address);
    }
    
    localStorage.setItem('at_saved_addresses', JSON.stringify(this.addresses));
    this.renderAddresses();
    
    // Auto-select new/updated address
    this.selectedAddressId = address.id;
    this.renderAddresses();
  }

  editAddress(address) {
    this.showAddressForm();
    
    // Fill form with existing data
    document.getElementById('addr-name').value = address.name;
    document.getElementById('addr-phone').value = address.phone;
    document.getElementById('addr-address').value = address.address;
    document.getElementById('addr-pincode').value = address.pincode;
    document.getElementById('addr-city').value = address.city;
    document.getElementById('addr-state').value = address.state;
    document.getElementById('addr-country').value = address.country;
    
    // Store editing ID
    document.querySelector('#add-address-form form').dataset.editingId = address.id;
    
    // Update form title
    document.querySelector('.at-form-title').textContent = 'Edit Address';
  }

  toggleAddressForm() {
    const form = document.getElementById('add-address-form');
    if (form.hidden) {
      this.showAddressForm();
    } else {
      this.hideAddressForm();
    }
  }

  showAddressForm() {
    const form = document.getElementById('add-address-form');
    form.hidden = false;
    
    // Clear form
    form.querySelector('form').reset();
    delete form.querySelector('form').dataset.editingId;
    document.querySelector('.at-form-title').textContent = 'Add New Address';
    
    // Focus first input
    setTimeout(() => {
      document.getElementById('addr-name').focus();
    }, 100);
  }

  hideAddressForm() {
    const form = document.getElementById('add-address-form');
    form.hidden = true;
    
    // Clear form and errors
    form.querySelector('form').reset();
    delete form.querySelector('form').dataset.editingId;
    form.querySelectorAll('.at-error').forEach(error => error.textContent = '');
  }

  async handleAddressSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const address = {
      name: formData.get('name') || document.getElementById('addr-name').value,
      phone: formData.get('phone') || document.getElementById('addr-phone').value,
      address: formData.get('address') || document.getElementById('addr-address').value,
      pincode: formData.get('pincode') || document.getElementById('addr-pincode').value,
      city: formData.get('city') || document.getElementById('addr-city').value,
      state: formData.get('state') || document.getElementById('addr-state').value,
      country: formData.get('country') || document.getElementById('addr-country').value
    };
    
    // Get values from inputs directly
    address.name = document.getElementById('addr-name').value.trim();
    address.phone = document.getElementById('addr-phone').value.trim();
    address.address = document.getElementById('addr-address').value.trim();
    address.pincode = document.getElementById('addr-pincode').value.trim();
    address.city = document.getElementById('addr-city').value.trim();
    address.state = document.getElementById('addr-state').value.trim();
    address.country = document.getElementById('addr-country').value.trim();
    
    if (!this.validateAddress(address)) {
      return;
    }
    
    // Check if editing
    const editingId = e.target.dataset.editingId;
    if (editingId) {
      address.id = editingId;
    }
    
    this.saveAddress(address);
    this.hideAddressForm();
    this.showStatus('Address saved successfully!');
  }

  validateAddress(address) {
    const fields = [
      { key: 'name', id: 'addr-name', message: 'Name is required' },
      { key: 'phone', id: 'addr-phone', message: 'Phone is required' },
      { key: 'address', id: 'addr-address', message: 'Address is required' },
      { key: 'pincode', id: 'addr-pincode', message: 'Pincode is required' },
      { key: 'city', id: 'addr-city', message: 'City is required' },
      { key: 'state', id: 'addr-state', message: 'State is required' },
      { key: 'country', id: 'addr-country', message: 'Country is required' }
    ];
    
    let isValid = true;
    
    fields.forEach(field => {
      const input = document.getElementById(field.id);
      const errorEl = input.parentNode.querySelector('.at-error');
      errorEl.textContent = '';
      
      if (!address[field.key]) {
        errorEl.textContent = field.message;
        isValid = false;
      }
    });
    
    // Validate phone
    const phoneInput = document.getElementById('addr-phone');
    const phoneError = phoneInput.parentNode.querySelector('.at-error');
    if (address.phone && !/^[6-9]\d{9}$/.test(address.phone)) {
      phoneError.textContent = 'Please enter a valid phone number';
      isValid = false;
    }
    
    // Validate pincode
    const pincodeInput = document.getElementById('addr-pincode');
    const pincodeError = pincodeInput.parentNode.querySelector('.at-error');
    if (address.pincode && !/^\d{6}$/.test(address.pincode)) {
      pincodeError.textContent = 'Please enter a valid 6-digit pincode';
      isValid = false;
    }
    
    return isValid;
  }

  handleAddressChange(addressId) {
    this.selectedAddressId = addressId;
    localStorage.setItem('at_last_address', addressId);
    this.updatePlaceOrderState();
  }

  // Discount Management
  async handleDiscountSubmit(e) {
    e.preventDefault();
    
    const discountInput = document.getElementById('discount-input');
    const code = discountInput.value.trim().toUpperCase();
    const btn = document.getElementById('apply-discount');
    const messageEl = document.getElementById('discount-message');
    
    if (!code) {
      messageEl.textContent = 'Please enter a discount code';
      messageEl.className = 'at-message at-error';
      return;
    }
    
    this.setButtonLoading(btn, true);
    messageEl.textContent = '';
    
    try {
      await this.applyDiscount(code);
      this.discountCode = code;
      messageEl.textContent = 'Discount applied successfully!';
      messageEl.className = 'at-message at-success';
    } catch (error) {
      messageEl.textContent = 'Invalid discount code';
      messageEl.className = 'at-message at-error';
    } finally {
      this.setButtonLoading(btn, false);
    }
  }

  // Mock discount validation - TODO: Replace with real API
  async applyDiscount(code) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Mock validation - accept "SAVE10" as valid
        if (code === 'SAVE10' || code === 'WELCOME') {
          resolve({ success: true, code });
        } else {
          reject(new Error('Invalid discount code'));
        }
      }, 1000);
    });
  }

  // Payment Management
  handlePaymentChange(paymentMethod) {
    this.selectedPaymentMethod = paymentMethod;
    localStorage.setItem('at_last_payment', paymentMethod);
    this.updatePlaceOrderState();
  }

  updatePlaceOrderState() {
    const placeOrderBtn = document.getElementById('place-order');
    const hasAddress = this.selectedAddressId;
    const hasPayment = this.selectedPaymentMethod;
    const isVerified = this.otpVerified;
    
    placeOrderBtn.disabled = !(hasAddress && hasPayment && isVerified);
  }

  // Final Checkout
  async handlePlaceOrder() {
    const btn = document.getElementById('place-order');
    this.setButtonLoading(btn, true);
    
    try {
      // Update cart attributes
      const attributes = {
        payment_method: this.selectedPaymentMethod,
        selected_address_id: this.selectedAddressId,
        phone_number: this.phoneNumber
      };
      
      if (this.discountCode) {
        attributes.discount_code = this.discountCode;
      }
      
      await this.updateCartAttributes(attributes);
      
      // Redirect to checkout
      let checkoutUrl = '/checkout';
      if (this.discountCode) {
        checkoutUrl += `?discount=${encodeURIComponent(this.discountCode)}`;
      }
      
      this.showStatus('Redirecting to checkout...');
      
      setTimeout(() => {
        window.location.href = checkoutUrl;
      }, 1000);
      
    } catch (error) {
      this.showError('payment-error', 'Failed to process order. Please try again.');
    } finally {
      this.setButtonLoading(btn, false);
    }
  }

  async updateCartAttributes(attributes) {
    try {
      const response = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ attributes })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update cart');
      }
      
      return await response.json();
    } catch (error) {
      // Mock for demo - in real implementation this would actually update Shopify cart
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('Cart attributes updated:', attributes);
          resolve({ success: true });
        }, 1000);
      });
    }
  }

  // Utility Functions
  setButtonLoading(button, loading) {
    const text = button.querySelector('.at-btn-text');
    const spinner = button.querySelector('.at-spinner');
    
    if (loading) {
      button.disabled = true;
      if (text) text.style.opacity = '0';
      if (spinner) spinner.hidden = false;
    } else {
      button.disabled = false;
      if (text) text.style.opacity = '1';
      if (spinner) spinner.hidden = true;
    }
  }

  showStatus(message) {
    const statusEl = document.getElementById('status-messages');
    statusEl.textContent = message;
    statusEl.classList.add('at-show');
    
    setTimeout(() => {
      statusEl.classList.remove('at-show');
    }, 3000);
  }

  showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.textContent = message;
    }
  }

  prefillLastUsedSelections() {
    // Restore last selected address
    const lastAddress = localStorage.getItem('at_last_address');
    if (lastAddress) {
      this.selectedAddressId = lastAddress;
    }
    
    // Restore last selected payment method
    const lastPayment = localStorage.getItem('at_last_payment');
    if (lastPayment) {
      this.selectedPaymentMethod = lastPayment;
      setTimeout(() => {
        const radio = document.querySelector(`input[name="payment"][value="${lastPayment}"]`);
        if (radio) radio.checked = true;
      }, 100);
    }
  }

  // Input validation helpers
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Initialize the checkout modal when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new CheckoutModal();
});

// Add input masking for numeric fields
document.addEventListener('input', (e) => {
  if (e.target.inputMode === 'numeric' || e.target.type === 'tel') {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  }
});

// Prevent form submission on Enter key in discount input
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'discount-input') {
    e.preventDefault();
    document.getElementById('apply-discount').click();
  }
});