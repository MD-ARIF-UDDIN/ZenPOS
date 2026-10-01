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
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header" style={{ position: 'relative' }}>
        {onClose && (
          <button 
            className="mobile-close-btn"
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '8px',
              top: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        )}
        <img 
          src={logoImg} 
          alt="Rajmahal Logo" 
          style={{ 
            width: '48px', 
            height: '48px', 
            objectFit: 'contain', 
            borderRadius: '10px', 
            padding: '2px', 
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(11, 37, 69, 0.08)',
            border: '1px solid #e2e8f0'
          }} 
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="sidebar-logo" style={{ color: 'var(--color-primary)', fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '15px', letterSpacing: '1px', lineHeight: 1.2 }}>
            RAJMAHAL
          </span>
          <span className="sidebar-subtitle" style={{ 
            display: 'block', 
            fontSize: '8.5px', 
            fontWeight: 700, 
            color: 'var(--text-muted)', 
            letterSpacing: '1.2px',
            fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
          }}>
            ELEGANCE — MENS WEAR
          </span>
        </div>
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
                <Icon size={17} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'var(--color-danger)',
                      color: 'white',
                      fontSize: '9.5px',
                      fontWeight: 'bold',
                      padding: '1px 5px',
                      borderRadius: '8px',
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
      <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid var(--border-color)', fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>ZenPOS V1</div>
        <div style={{ marginTop: '2px', fontSize: '10px' }}>
          By: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>MD Arif Uddin</span>
          <br />
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
              gap: '2px',
              marginTop: '2px'
            }}
          >
            💬 01825334505
          </a>
        </div>
      </div>
    </aside>
  );
};

