'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const CATEGORIES = [
  'Food & Beverage', 'Groceries', 'Health', 'Transportation',
  'Shopping', 'Utilities', 'Entertainment', 'UNCATEGORIZED',
];

export default function HomePage() {
  // Auth state
  const [pin, setPin] = useState('');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');

  // Upload state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Result state
  const [parsedResult, setParsedResult] = useState(null);
  const [editedFields, setEditedFields] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Quota state
  const [quota, setQuota] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  // Recent expenses
  const [recentExpenses, setRecentExpenses] = useState([]);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Check for stored session
  useEffect(() => {
    const stored = sessionStorage.getItem('expense_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setPin(parsed.pin);
      } catch { /* ignore */ }
    }
  }, []);

  // Fetch quota and recent expenses when authenticated
  useEffect(() => {
    if (!user) return;
    fetchQuota();
    fetchRecentExpenses();
  }, [user]);

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/quota');
      if (res.ok) {
        const data = await res.json();
        setQuota(data);
      }
    } catch { /* ignore */ }
  };

  const fetchRecentExpenses = async () => {
    try {
      const res = await fetch(`/api/expenses?limit=5&pin=${pin}`);
      if (res.ok) {
        const data = await res.json();
        setRecentExpenses(data.expenses || []);
      }
    } catch { /* ignore */ }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Auth ────────────────────────────────────────────────────

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!pin || pin.length < 4) {
      setAuthError('Enter your PIN');
      return;
    }

    // Validate by trying to fetch quota (lightweight check)
    try {
      const usersJson = process.env.NEXT_PUBLIC_APP_USERS;
      // We can't access env on client side, so we'll validate on first upload
      // For now, just set the user optimistically
      // The actual validation happens server-side
      sessionStorage.setItem('expense_user', JSON.stringify({ pin, user: 'User' }));
      setUser('User');
    } catch (err) {
      setAuthError('Invalid PIN or system error');
    }
  };

  const handleSignOut = () => {
    sessionStorage.removeItem('expense_user');
    setUser(null);
    setPin('');
  };

  // ─── Main Flow ───────────────────────────────────────────────

  const handleImageSelect = useCallback((file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image must be under 10MB', 'error');
      return;
    }

    setSelectedImage(file);
    setParsedResult(null);
    setEditedFields(null);

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImageSelect(file);
  }, [handleImageSelect]);

  const handleUpload = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('pin', pin);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          sessionStorage.removeItem('expense_user');
          showToast('Invalid PIN. Please log in again.', 'error');
          return;
        }
        throw new Error(data.error || 'Upload failed');
      }

      if (data.status === 'QUOTA_PAUSED') {
        showToast(data.message, 'warning');
        setQuota(data.quota);
        setSelectedImage(null);
        setImagePreview(null);
        return;
      }

      // Store user name from server response
      if (data.submitter && data.submitter !== user) {
        setUser(data.submitter);
        sessionStorage.setItem('expense_user', JSON.stringify({ pin, user: data.submitter }));
      }

      setParsedResult(data);
      setEditedFields({ ...data.parsed });
      if (data.quota) setQuota(data.quota);

      showToast('Receipt parsed successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Confirm / Reject ────────────────────────────────────────

  const handleConfirm = async () => {
    if (!parsedResult || !editedFields) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('receipt_id', parsedResult.receipt_id);
      formData.append('submitter', parsedResult.submitter || user);
      formData.append('confirmed_fields', JSON.stringify(editedFields));
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const res = await fetch('/api/upload/confirm', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      showToast('Expense saved! ✅', 'success');
      resetUpload();
      fetchRecentExpenses();
      fetchQuota();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = () => {
    resetUpload();
    showToast('Receipt discarded', 'warning');
  };

  const resetUpload = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setParsedResult(null);
    setEditedFields(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const updateField = (field, value) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
  };

  // ─── Helpers ─────────────────────────────────────────────────

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return amount;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const getConfidenceClass = (score) => {
    if (score >= 0.7) return 'confidence-high';
    if (score >= 0.5) return 'confidence-medium';
    return 'confidence-low';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Beverage': '🍽️',
      'Groceries': '🛒',
      'Health': '💊',
      'Transportation': '🚗',
      'Shopping': '🛍️',
      'Utilities': '⚡',
      'Entertainment': '🎬',
      'UNCATEGORIZED': '📋',
    };
    return icons[category] || '📋';
  };

  // ─── Login Screen ────────────────────────────────────────────

  if (!user) {
    return (
      <div className="app-container">
        <div className="login-container">
          <img src="/receipt-illustration.png" alt="Expense Tracker" style={{ width: '240px', height: 'auto', objectFit: 'contain' }} />
          <h1 className="login-title">Expense Tracker</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Enter your PIN to continue
          </p>
          <form className="login-form" onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className="pin-input"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={8}
              autoFocus
            />
            {authError && (
              <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{authError}</p>
            )}
            <button type="submit" className="btn btn-primary">
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Main App ────────────────────────────────────────────────

  return (
    <div className="app-container">
      {/* Loading Overlay */}
      {isUploading && (
        <div className="loading-overlay">
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
          <p className="loading-text">Scanning receipt...</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Running OCR & parsing fields
          </p>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <h1 className="app-logo">Expense Tracker</h1>
        <p className="app-subtitle">Snap • Parse • Track</p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
          <div className="user-badge" style={{ marginTop: 0 }}>
            👤 {user}
          </div>
          <button 
            onClick={handleSignOut}
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--border)', 
              color: 'var(--text-muted)', 
              borderRadius: 'var(--radius-full)', 
              padding: '4px 12px', 
              fontSize: '0.75rem', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.target.style.color = 'var(--text-primary)'; e.target.style.borderColor = 'var(--text-secondary)'; }}
            onMouseOut={(e) => { e.target.style.color = 'var(--text-muted)'; e.target.style.borderColor = 'var(--border)'; }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Quota Bar */}
      {quota && (
        <div className="quota-bar">
          <div className="quota-header">
            <span className="quota-label">OCR Quota</span>
            <span className="quota-count">{quota.used} / {quota.limit}</span>
          </div>
          <div className="quota-track">
            <div
              className={`quota-fill ${quota.percentUsed >= 95 ? 'critical' : quota.percentUsed >= 80 ? 'warning' : ''}`}
              style={{ width: `${Math.min(100, quota.percentUsed || 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Zone or Result */}
      {!parsedResult ? (
        <>
          {/* Image Preview */}
          {imagePreview && (
            <div className="image-preview fade-in">
              <img src={imagePreview} alt="Receipt preview" />
              <div className="image-preview-overlay">
                <button
                  className="image-preview-remove"
                  onClick={resetUpload}
                  title="Remove image"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Upload Actions */}
          {!imagePreview && (
            <div
              className={`upload-actions ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', padding: 'var(--space-md) 0' }}
            >
              <button 
                className="btn btn-primary" 
                style={{ position: 'relative', padding: '6px', fontSize: '1.1rem', height: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', width: '60%', margin: '0 auto', overflow: 'hidden', alignItems: 'center' }}
              >
                <img src="/camera-icon.png" alt="Camera" style={{ width: '200px', height: '200px', objectFit: 'contain' }} />
                <span>Use Camera</span>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleImageSelect(e.target.files?.[0])}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                />
              </button>
              
              <button 
                className="btn btn-secondary" 
                style={{ position: 'relative', padding: '16px', display: 'flex', gap: '8px', justifyContent: 'center', width: '100%', overflow: 'hidden' }}
              >
                <span>Load from Gallery</span>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageSelect(e.target.files?.[0])}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                />
              </button>
            </div>
          )}

          {/* Upload Button */}
          {selectedImage && !isUploading && (
            <button
              className="btn btn-primary mt-md fade-in"
              onClick={handleUpload}
            >
              🔍 Scan & Parse Receipt
            </button>
          )}
        </>
      ) : (
        /* Result Card */
        <div className="card result-card">
          <div className="result-header">
            <h2 className="result-title">
              <span className="emoji">✨</span>Receipt Parsed
            </h2>
            <span className={`confidence-badge ${getConfidenceClass(editedFields?.confidence_score)}`}>
              ⭐ {Math.round((editedFields?.confidence_score || 0) * 100)}%
            </span>
          </div>

          {/* Image Thumbnail */}
          {imagePreview && (
            <div className="image-preview" style={{ marginBottom: 'var(--space-lg)' }}>
              <img src={imagePreview} alt="Receipt" style={{ height: 140 }} />
            </div>
          )}

          {/* Editable Fields */}
          <div className="field-group">
            <div className="field-row">
              <span className="field-icon">🏪</span>
              <div className="field-value">
                <input
                  className="field-input"
                  value={editedFields?.merchant_name || ''}
                  onChange={(e) => updateField('merchant_name', e.target.value)}
                  placeholder="Merchant name"
                />
              </div>
            </div>

            <div className="field-row">
              <span className="field-icon">📅</span>
              <div className="field-value">
                <input
                  className="field-input"
                  type="date"
                  value={editedFields?.transaction_date || ''}
                  onChange={(e) => updateField('transaction_date', e.target.value)}
                />
              </div>
            </div>

            <div className="field-row">
              <span className="field-icon">💰</span>
              <div className="field-value">
                <input
                  className="field-input"
                  type="number"
                  value={editedFields?.total_amount || ''}
                  onChange={(e) => updateField('total_amount', e.target.value)}
                  placeholder="Total amount"
                />
              </div>
            </div>

            <div className="field-row">
              <span className="field-icon">🧾</span>
              <div className="field-value">
                <input
                  className="field-input"
                  type="number"
                  value={editedFields?.tax_amount || ''}
                  onChange={(e) => updateField('tax_amount', e.target.value)}
                  placeholder="Tax (PPN)"
                />
              </div>
            </div>

            <div className="field-row">
              <span className="field-icon">🍽️</span>
              <div className="field-value">
                <input
                  className="field-input"
                  type="number"
                  value={editedFields?.service_charge || ''}
                  onChange={(e) => updateField('service_charge', e.target.value)}
                  placeholder="Service charge"
                />
              </div>
            </div>

            <div className="field-row">
              <span className="field-icon">📂</span>
              <div className="field-value">
                <select
                  className="field-select"
                  value={editedFields?.category || 'UNCATEGORIZED'}
                  onChange={(e) => updateField('category', e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-row">
              <span className="field-icon">📝</span>
              <div className="field-value">
                <input
                  className="field-input"
                  value={editedFields?.notes || ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Notes (optional)"
                />
              </div>
            </div>
          </div>

          <div className="btn-group">
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={isSaving}
            >
              {isSaving ? <span className="spinner"></span> : '✅'} Confirm
            </button>
            <button
              className="btn btn-danger"
              onClick={handleReject}
              disabled={isSaving}
            >
              ❌ Reject
            </button>
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      {!parsedResult && recentExpenses.length > 0 && (
        <>
          <h3 className="section-title">Recent Expenses</h3>
          <div className="expense-list">
            {recentExpenses.map((exp, i) => (
              <div key={i} className="expense-item fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="expense-icon">
                  {getCategoryIcon(exp.category)}
                </div>
                <div className="expense-details">
                  <div className="expense-merchant">{exp.merchant_name || 'Unknown'}</div>
                  <div className="expense-date">{exp.transaction_date || exp.timestamp?.slice(0, 10)}</div>
                </div>
                <div className="expense-amount">
                  {formatCurrency(exp.total_amount)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button className="nav-item active">
          <span className="nav-icon">📷</span>
          Scan
        </button>
        <Link href="/history" className="nav-item" style={{ textDecoration: 'none' }}>
          <span className="nav-icon">📋</span>
          History
        </Link>
      </nav>
    </div>
  );
}
