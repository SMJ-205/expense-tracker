'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HistoryPage() {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pin, setPin] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('expense_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPin(parsed.pin);
        fetchExpenses(parsed.pin);
      } catch {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = () => {
    sessionStorage.removeItem('expense_user');
    setPin('');
  };

  const fetchExpenses = async (userPin) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/expenses?limit=100&pin=${userPin}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return amount;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
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

  const getStatusClass = (status) => {
    if (status === 'CONFIRMED') return 'status-confirmed';
    if (status === 'NEEDS_REVIEW') return 'status-needs-review';
    if (status === 'QUOTA_PAUSED') return 'status-paused';
    return '';
  };

  // Calculate summary
  const totalSpent = expenses.reduce((sum, exp) => {
    const amount = parseFloat(exp.total_amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const categoryCounts = expenses.reduce((acc, exp) => {
    const cat = exp.category || 'UNCATEGORIZED';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

  if (!pin) {
    return (
      <div className="app-container">
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <p>Please log in from the main page first.</p>
          <Link href="/" className="btn btn-primary mt-md" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="history-header">
        <h1 className="history-title">Expense History</h1>
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

      {/* Summary Cards */}
      {!isLoading && expenses.length > 0 && (
        <div className="history-summary">
          <div className="summary-card">
            <div className="summary-value">{formatCurrency(totalSpent)}</div>
            <div className="summary-label">Total Spent</div>
          </div>
          <div className="summary-card">
            <div className="summary-value">{expenses.length}</div>
            <div className="summary-label">Receipts</div>
          </div>
          <div className="summary-card">
            <div className="summary-value">{Object.keys(categoryCounts).length}</div>
            <div className="summary-label">Categories</div>
          </div>
          <div className="summary-card">
            <div className="summary-value">
              {topCategory ? getCategoryIcon(topCategory[0]) : '-'}
            </div>
            <div className="summary-label">Top Category</div>
          </div>
        </div>
      )}

      {/* Expense List */}
      {isLoading ? (
        <div className="expense-list">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="expense-item" style={{ opacity: 0.5 }}>
              <div className="shimmer" style={{ width: 40, height: 40, borderRadius: 8 }}></div>
              <div className="expense-details" style={{ flex: 1 }}>
                <div className="shimmer" style={{ width: '60%', marginBottom: 6 }}></div>
                <div className="shimmer" style={{ width: '30%', height: 14 }}></div>
              </div>
              <div className="shimmer" style={{ width: 70 }}></div>
            </div>
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No expenses recorded yet.</p>
          <p style={{ fontSize: '0.8rem', marginTop: 8, color: 'var(--text-muted)' }}>
            Scan your first receipt to get started!
          </p>
        </div>
      ) : (
        <div className="expense-list">
          {expenses.map((exp, i) => (
            <div
              key={i}
              className="expense-item fade-in"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <div className="expense-icon">
                {getCategoryIcon(exp.category)}
              </div>
              <div className="expense-details">
                <div className="expense-merchant">
                  {exp.merchant_name || 'Unknown Merchant'}
                </div>
                <div className="expense-date">
                  {exp.transaction_date || exp.timestamp?.slice(0, 10)}
                  {exp.submitter && (
                    <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                      • {exp.submitter}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="expense-amount">
                  {formatCurrency(exp.total_amount)}
                </div>
                <span className={`status-badge ${getStatusClass(exp.status)}`}>
                  {exp.status === 'CONFIRMED' ? '✓' : exp.status === 'NEEDS_REVIEW' ? '!' : '⏸'}
                  {' '}{exp.status?.replace('_', ' ') || ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <Link href="/" className="nav-item" style={{ textDecoration: 'none' }}>
          <span className="nav-icon">📷</span>
          Scan
        </Link>
        <button className="nav-item active">
          <span className="nav-icon">📋</span>
          History
        </button>
      </nav>
    </div>
  );
}
