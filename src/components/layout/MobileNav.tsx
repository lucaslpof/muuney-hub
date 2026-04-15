import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './MobileNav.css';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

/**
 * MobileNav - Bottom navigation para mobile (< 768px).
 * Componente que substitui/complementa a sidebar em viewports mobile.
 * Ícones simplificados + labels. Integrado no HubLayout.
 */
export const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      id: 'macro',
      label: 'Macro',
      icon: <span className="mobile-nav-icon">📊</span>,
      path: '/hub/macro',
    },
    {
      id: 'credito',
      label: 'Crédito',
      icon: <span className="mobile-nav-icon">💳</span>,
      path: '/hub/credito',
    },
    {
      id: 'renda-fixa',
      label: 'Renda Fixa',
      icon: <span className="mobile-nav-icon">📈</span>,
      path: '/hub/renda-fixa',
    },
    {
      id: 'fundos',
      label: 'Fundos',
      icon: <span className="mobile-nav-icon">🎯</span>,
      path: '/hub/fundos',
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      icon: <span className="mobile-nav-icon">💼</span>,
      path: '/hub/portfolio',
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-container">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`mobile-nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-label={item.label}
            aria-current={isActive(item.path) ? 'page' : undefined}
          >
            <div className="mobile-nav-icon-wrapper">{item.icon}</div>
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
