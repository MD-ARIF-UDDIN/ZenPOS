import { ShoppingCart, Shirt, TrendingUp, AlertTriangle, Truck, Users, FileText, X, Receipt } from 'lucide-react';
import logoImg from '../assets/logo.jpg';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  lowStockCount: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setTab, lowStockCount, isOpen, onClose }) => {
  const menuItems = [
    { id: 'pos', label: 'POS Checkout', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: Shirt },
    { id: 'purchases', label: 'Purchases', icon: Truck },
    { id: 'stock', label: 'Stock & Inventory', icon: AlertTriangle, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { id: 'sales', label: 'Sales History', icon: FileText },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'users', label: 'Staff Management', icon: Users },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
  ];

  const handleItemClick = (tabId: string) => {
    setTab(tabId);
    onClose?.();
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header" style={{ position: 'relative' }}>
        {onClose && (
          <button 
            className="mobile-close-btn"
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '12px',
              top: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            <X size={20} />
          </button>
        )}
        <img src={logoImg} alt="ZenPOS Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '50%', padding: '2px', background: '#fff' }} />
        <span className="sidebar-logo">ZenPOS V1</span>
        <span className="sidebar-subtitle" style={{ 
          display: 'block', 
          fontSize: '12px', 
          fontWeight: 500, 
          color: 'var(--text-secondary)', 
          marginTop: '4px',
          fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
        }}>
          Owner: Sakib Hasan
        </span>
      </div>
      <ul className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <a
                onClick={() => handleItemClick(item.id)}
                className={`sidebar-item ${currentTab === item.id ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'var(--color-danger)',
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
      <div style={{ marginTop: 'auto', padding: '20px 24px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
        <div>ZenPOS V1</div>
        <div style={{ marginTop: '6px', fontSize: '10px' }}>
          Developed By: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>MD Arif Uddin</span>
          <br />
          Contact:{' '}
          <a 
            href="https://wa.me/8801825334505" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              color: 'var(--color-primary)', 
              fontWeight: 700, 
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            💬 01825334505
          </a>
        </div>
      </div>
    </div>
  );
};
