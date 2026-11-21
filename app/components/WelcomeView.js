'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, Cloud, Calendar, Sparkles, BookOpen, Layers } from 'lucide-react';

export default function WelcomeView({
  onAddGroup,
  onLoginClick,
  onCreateEvent,
  isDark = false,
}) {
  const containerRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    // Rotación sutil y controlada (máximo ±6 grados)
    setTilt({
      x: Math.max(-6, Math.min(6, -y * 10)),
      y: Math.max(-6, Math.min(6, x * 10)),
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  return (
    <div className="welcome-view-wrap">
      {/* ── Composición 3D espacial 'Antigravity' ── */}
      <div
        ref={containerRef}
        className="welcome-stage"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: isHovered
            ? 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)'
            : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        aria-hidden="true"
      >
        {/* Glow difuso de fondo */}
        <div className="welcome-glow" />

        {/* Tarjeta 1: Teoría / Magistral (Atrás a la izquierda) */}
        <div className="welcome-card welcome-card-1">
          <div className="welcome-card-header">
            <span className="welcome-badge welcome-badge-blue">
              Magistral
            </span>
            <span className="welcome-time">09:00–11:00</span>
          </div>
          <div className="welcome-card-title">Cálculo I</div>
          <div className="welcome-card-footer">
            <span>Aula 1.4</span>
            <span className="welcome-dot">·</span>
            <span>Semanal</span>
          </div>
        </div>

        {/* Tarjeta 2: Práctica / Laboratorio (Centro, primer plano) */}
        <div className="welcome-card welcome-card-2">
          <div className="welcome-card-header">
            <span className="welcome-badge welcome-badge-emerald">
              Laboratorio
            </span>
            <span className="welcome-time">11:30–13:30</span>
          </div>
          <div className="welcome-card-title">Programación Básica</div>
          <div className="welcome-card-footer">
            <span>Lab P2G3A</span>
            <span className="welcome-dot">·</span>
            <span>Subgrupo 1</span>
          </div>
        </div>

        {/* Tarjeta 3: Evento Personal / Estudio (Abajo a la derecha) */}
        <div className="welcome-card welcome-card-3">
          <div className="welcome-card-header">
            <span className="welcome-badge welcome-badge-purple">
              <Sparkles size={11} className="mr-1 inline-block" />
              Estudio
            </span>
            <span className="welcome-time">16:00–18:00</span>
          </div>
          <div className="welcome-card-title">Repaso examen parcial</div>
          <div className="welcome-card-footer">
            <span>Biblioteca central</span>
            <span className="welcome-dot">·</span>
            <span>Personal</span>
          </div>
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
