'use client';

export default function ProfileView() {
  return (
    <div className="profile-view">
      <div className="profile-avatar">🎓</div>
      <div>
        <div className="profile-name">EHUntis</div>
        <div className="profile-sub">Horarios EHU · Versión 0.1</div>
      </div>

      <a
        href="https://ehu.webuntis.com/WebUntis/?school=ehu#/basic/timetablePublic"
        target="_blank"
        rel="noopener noreferrer"
        className="profile-link-btn"
      >
        🌐 Abrir WebUntis oficial
      </a>

      <div style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>EHUntis</strong> es una app no oficial que utiliza los datos públicos de WebUntis para mostrar los horarios de la EHU/UPV de una forma más cómoda.
        </div>
      </div>

      <div className="profile-version">
        Datos de EHU · ehu.webuntis.com<br />
        Curso académico 2026–2027
      </div>
    </div>
  );
}
