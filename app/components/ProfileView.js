'use client';

import { useState, useRef } from 'react';
import posthog from 'posthog-js';
import {
  GraduationCap,
  ExternalLink,
  CloudOff,
  Cloud,
  LogIn,
  UserPlus,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Smartphone,
  ChevronRight,
  Layers,
} from 'lucide-react';

// ── Username validation ────────────────────────────────────────────────────────
const USERNAME_REGEX = /^[a-zA-Z0-9_\-.]{6,30}$/;

function validateUsername(value) {
  if (!value || value.trim() === '') return 'El identificador no puede estar vacío.';
  if (!USERNAME_REGEX.test(value.trim()))
    return 'Debe tener entre 6 y 30 caracteres. Solo letras, números, guiones o puntos.';
  return null;
}

// ── Auth form (shared for register + login) ────────────────────────────────────
function AuthForm({ mode, onSubmit, loading }) {
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState(null);
  const inputRef = useRef(null);

  const isRegister = mode === 'register';

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateUsername(value);
    if (err) {
      setValidationError(err);
      inputRef.current?.focus();
      return;
    }
    setValidationError(null);
    onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
          {isRegister ? 'Crea un identificador' : 'Tu identificador'}
        </label>
        {isRegister && (
          <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-secondary)' }}>
            Recomendado: utilizar tu identificador de la EHU
          </p>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setValidationError(null); }}
          placeholder="1234567"
          disabled={loading}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${validationError ? '#ef4444' : 'var(--border)'}`,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 15,
            outline: 'none',
            transition: 'border-color 0.15s',
            fontFamily: 'var(--font-body)',
            width: '100%',
          }}
        />
      </div>
      {validationError && (
        <p style={{ margin: 0, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={13} /> {validationError}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="sync-btn-primary"
      >
        {loading ? (
          <><Loader2 size={16} className="spin" /> Procesando…</>
        ) : isRegister ? (
          <><UserPlus size={16} /> Crear cuenta</>
        ) : (
          <><LogIn size={16} /> Iniciar sesión</>
        )}
      </button>
    </form>
  );
}

// ── Sync status badge ──────────────────────────────────────────────────────────
function SyncBadge({ status, error }) {
  const configs = {
    idle: { icon: <Cloud size={14} />, text: 'Sincronización activa', color: 'var(--text-secondary)' },
    syncing: { icon: <Loader2 size={14} className="spin" />, text: 'Sincronizando…', color: 'var(--accent)' },
    synced: { icon: <CheckCircle2 size={14} />, text: 'Sincronizado', color: '#22c55e' },
    error: { icon: <AlertCircle size={14} />, text: error || 'Error al sincronizar', color: '#ef4444' },
  };
  const cfg = configs[status] || configs.idle;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: cfg.color, fontWeight: 500 }}>
      {cfg.icon} {cfg.text}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProfileView({
  username = '',
  syncStatus = 'idle',
  syncError = null,
  onRegister,
  onLogin,
  onLogout,
}) {
  // Which auth panel is open: null | 'register' | 'login'
  const [authPanel, setAuthPanel] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Conflict resolution state: null or { username, cloudConfigs, cloudActiveId, localConfigs }
  const [conflictData, setConflictData] = useState(null);

  const isLoggedIn = Boolean(username);

  async function handleAuth(mode, value) {
    setSubmitting(true);
    setActionError(null);
    try {
      if (mode === 'register') {
        await onRegister(value);
        setAuthPanel(null);
      } else {
        const res = await onLogin(value);
        if (res?.conflict) {
          setConflictData(res);
        } else {
          setAuthPanel(null);
        }
      }
    } catch (err) {
      setActionError(err.message || 'Error desconocido.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolveConflict(choice) {
    if (!conflictData) return;
    setSubmitting(true);
    setActionError(null);
    try {
      try { posthog?.capture('account_conflict_resolved', { choice }); } catch (_) {}
      await onLogin(conflictData.username, choice, {
        configs: conflictData.cloudConfigs,
        active_config_id: conflictData.cloudActiveId,
      });
      setConflictData(null);
      setAuthPanel(null);
    } catch (err) {
      setActionError(err.message || 'Error al resolver el conflicto.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelConflict() {
    try { posthog?.capture('account_conflict_cancelled'); } catch (_) {}
    setConflictData(null);
    setActionError(null);
  }

  function handleLogout() {
    setActionError(null);
    setConflictData(null);
    onLogout();
  }

  return (
    <div className="profile-view">
      {/* ── Header ── */}
      <div className="profile-header">
        <div
          style={{
            background: 'var(--accent)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
          }}
        >
          <GraduationCap size={40} strokeWidth={1.5} />
        </div>
        <h2 className="profile-name">EHUntis</h2>
        <p className="profile-subtitle">Horarios UPV/EHU</p>
      </div>

      <div className="profile-content">

        {/* ── Sync / Account section ── */}
        <div className="profile-card sync-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {isLoggedIn ? (
              <Cloud size={20} color="var(--accent)" strokeWidth={2} />
            ) : (
              <CloudOff size={20} color="var(--text-secondary)" strokeWidth={2} />
            )}
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {isLoggedIn ? 'Cuenta conectada' : 'Sincronización en la nube'}
            </span>
          </div>

          {isLoggedIn ? (
            /* ── Logged-in state ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Identificador</p>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {username}
                  </p>
                </div>
                <SyncBadge status={syncStatus} error={syncError} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Tus preferencias se sincronizan automáticamente entre todos tus dispositivos.
              </p>
              <button onClick={handleLogout} className="sync-btn-secondary" style={{ marginTop: 4 }}>
                <LogOut size={15} /> Cerrar sesión
              </button>
            </div>
          ) : conflictData ? (
            /* ── Conflict resolution state (3 choices) ── */
            <div className="sync-conflict-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', marginBottom: 6 }}>
                <AlertTriangle size={20} strokeWidth={2.2} />
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  Conflicto de preferencias
                </span>
              </div>

              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Hemos encontrado preferencias guardadas en tu cuenta de la nube y también en este dispositivo.
              </p>

              {/* Comparison overview */}
              <div className="sync-comparison-grid">
                <div className="sync-comparison-col">
                  <div className="sync-col-header">
                    <Cloud size={14} color="var(--accent)" />
                    <span>En la nube ({conflictData.cloudConfigs?.length || 0})</span>
                  </div>
                  <div className="sync-col-body">
                    {(conflictData.cloudConfigs || []).map((c, i) => (
                      <div key={c.id || i} className="sync-col-item">
                        <span className="sync-col-item-name" title={c.name}>{c.name || 'Sin nombre'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sync-comparison-col">
                  <div className="sync-col-header">
                    <Smartphone size={14} color="var(--accent)" />
                    <span>En este dispositivo ({conflictData.localConfigs?.length || 0})</span>
                  </div>
                  <div className="sync-col-body">
                    {(conflictData.localConfigs || []).map((c, i) => (
                      <div key={c.id || i} className="sync-col-item">
                        <span className="sync-col-item-name" title={c.name}>{c.name || 'Sin nombre'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p style={{ margin: '14px 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                ¿Qué deseas hacer?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  disabled={submitting}
                  className="sync-btn-secondary sync-conflict-btn"
                  onClick={() => handleResolveConflict('merge')}
                >
                  <div className="sync-btn-content">
                    <div className="sync-btn-title">
                      <Layers size={16} /> Combinar ambas
                    </div>
                    <div className="sync-btn-desc">
                      Junta todas las configuraciones para no perder nada.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  className="sync-btn-secondary sync-conflict-btn"
                  onClick={() => handleResolveConflict('cloud')}
                >
                  <div className="sync-btn-content">
                    <div className="sync-btn-title">
                      <Cloud size={16} /> Usar datos de la nube
                    </div>
                    <div className="sync-btn-desc">
                      Descarga las configuraciones de la nube y sobrescribe las de este dispositivo.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  className="sync-btn-secondary sync-conflict-btn"
                  onClick={() => handleResolveConflict('local')}
                >
                  <div className="sync-btn-content">
                    <div className="sync-btn-title">
                      <Smartphone size={16} /> Mantener datos de este dispositivo
                    </div>
                    <div className="sync-btn-desc">
                      Sube tus configuraciones actuales a la nube y sobrescribe las anteriores.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  className="sync-btn-ghost"
                  onClick={handleCancelConflict}
                  style={{ marginTop: 4 }}
                >
                  Cancelar inicio de sesión
                </button>
              </div>

              {actionError && (
                <div className="sync-error-banner" style={{ marginTop: 10 }}>
                  <AlertCircle size={15} />
                  <span>{actionError}</span>
                </div>
              )}
            </div>
          ) : (
            /* ── Logged-out state ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Guarda tus preferencias en la nube y accede a ellas desde cualquier dispositivo.
              </p>

              {/* Auth panel switcher */}
              {authPanel === null && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="sync-btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setAuthPanel('register');
                      setActionError(null);
                      try { posthog?.capture('account_auth_form_opened', { mode: 'register' }); } catch (_) {}
                    }}
                  >
                    <UserPlus size={15} /> Crear cuenta
                  </button>
                  <button
                    className="sync-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setAuthPanel('login');
                      setActionError(null);
                      try { posthog?.capture('account_auth_form_opened', { mode: 'login' }); } catch (_) {}
                    }}
                  >
                    <LogIn size={15} /> Iniciar sesión
                  </button>
                </div>
              )}

              {authPanel === 'register' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <AuthForm mode="register" loading={submitting} onSubmit={v => handleAuth('register', v)} />
                  <button
                    className="sync-btn-ghost"
                    onClick={() => { setAuthPanel(null); setActionError(null); }}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {authPanel === 'login' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <AuthForm mode="login" loading={submitting} onSubmit={v => handleAuth('login', v)} />
                  <button
                    className="sync-btn-ghost"
                    onClick={() => { setAuthPanel(null); setActionError(null); }}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {actionError && (
                <div className="sync-error-banner">
                  <AlertCircle size={15} />
                  <span>{actionError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Widget section (placeholder — Fase 4) ── */}
        <div className="profile-card widget-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Smartphone size={20} color="var(--accent)" strokeWidth={2} />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              Widget para el móvil
            </span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Consulta tu próxima clase directamente desde la pantalla de inicio de tu móvil, sin abrir la app.
          </p>
          <button
            className="sync-btn-accent-outline"
            onClick={() => {/* Fase 4: link to /widgets guide */}}
          >
            <span>Ver Guía de Instalación y Descargas</span>
            <ChevronRight size={15} />
          </button>
        </div>

        {/* ── WebUntis link ── */}
        <a
          href="https://ehu.webuntis.com/WebUntis/#/basic/timetablePublic"
          target="_blank"
          rel="noopener noreferrer"
          className="profile-link-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--accent)',
            fontWeight: 600,
            textDecoration: 'none',
            background: 'var(--accent-light)',
            padding: '12px 20px',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <ExternalLink size={20} strokeWidth={2} />
          Abrir WebUntis oficial
        </a>

        {/* ── Footer ── */}
        <div className="profile-footer">
          Datos obtenidos de ehu.webuntis.com<br />
          Curso académico 2026–2027
        </div>
      </div>
    </div>
  );
}
