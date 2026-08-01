'use client';

export default function ProfileView() {
  return (
    <div className="profile-view">
      <div className="profile-header">
        <div className="profile-avatar">
          🎓
        </div>
        <h2 className="profile-name">EHUntis</h2>
        <p className="profile-subtitle">Horarios UPV/EHU · Versión 0.1</p>
      </div>

      <div className="profile-content">
        <a 
          href="https://ehu.webuntis.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="profile-link-btn"
        >
          <span className="profile-link-icon">🌐</span>
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
