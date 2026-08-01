'use client';

import { GraduationCap, ExternalLink } from 'lucide-react';

export default function ProfileView() {
  return (
    <div className="profile-view">
      <div className="profile-header">
        <div className="profile-avatar" style={{ background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GraduationCap size={40} strokeWidth={1.5} />
        </div>
        <h2 className="profile-name">EHUntis</h2>
        <p className="profile-subtitle">Horarios UPV/EHU</p>
      </div>

      <div className="profile-content">
        <a 
          href="https://ehu.webuntis.com/WebUntis/#/basic/timetablePublic" 
          target="_blank" 
          rel="noopener noreferrer"
          className="profile-link-btn"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', background: 'var(--accent-light)', padding: '12px 20px', borderRadius: 'var(--radius-lg)' }}
        >
          <ExternalLink size={20} strokeWidth={2} />
          Abrir WebUntis oficial
        </a>

        <div className="profile-card">
          <p>
            <strong>EHUntis</strong> es una app no oficial que utiliza los datos públicos de WebUntis 
            para mostrar los horarios de la UPV/EHU de una forma más cómoda y adaptada a móviles.
          </p>
        </div>

        <div className="profile-footer">
          Datos obtenidos de ehu.webuntis.com<br />
          Curso académico 2026–2027
        </div>
      </div>
    </div>
  );
}
