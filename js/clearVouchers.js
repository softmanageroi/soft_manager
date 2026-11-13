window.clearAllSavedVouchers = function () {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => localStorage.removeItem(key));
    if (typeof window !== 'undefined') {
      window.alert('All saved vouchers and related data were cleared.');
    }
  } catch (error) {
    console.error('Could not clear saved vouchers:', error);
  }
};
