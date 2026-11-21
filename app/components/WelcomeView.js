'use client';

import { Plus, Cloud, Calendar } from 'lucide-react';

export default function WelcomeView({
  onAddGroup,
  onLoginClick,
  onCreateEvent,
}) {
  return (
    <div className="welcome-view-wrap">
      {/* ── Icono-insignia compacto y discreto con halo ambiental ── */}
      <div className="welcome-badge-container">
        <div className="welcome-ambient-glow" aria-hidden="true" />
        <div className="welcome-icon-badge" aria-hidden="true">
          <Calendar size={26} strokeWidth={1.85} />
        </div>
      </div>

      {/* ── Bloque Tipográfico Display Minimalista ── */}
      <div className="welcome-content">
        <h1 className="welcome-title">
          Bienvenido a EHUntis
        </h1>
        <p className="welcome-subtitle">
          Configura tu horario en segundos para empezar.
        </p>

        {/* ── Botonera de Acciones Inmediatas (Zero-Friction CTAs) ── */}
        <div className="welcome-actions">
          <button
            type="button"
            className="welcome-btn-primary"
            onClick={onAddGroup}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Añadir titulación o grupo</span>
          </button>

          <button
            type="button"
            className="welcome-btn-secondary"
            onClick={onLoginClick}
          >
            <Cloud size={16} strokeWidth={2} />
            <span>¿Ya tienes horario? Iniciar sesión</span>
          </button>

          {onCreateEvent && (
            <button
              type="button"
              className="welcome-btn-ghost"
              onClick={onCreateEvent}
            >
              <span>+ Crear evento personal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
