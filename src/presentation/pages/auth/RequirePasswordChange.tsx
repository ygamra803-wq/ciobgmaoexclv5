import { useState } from 'react';
import {
  KeyRound,
  ShieldAlert,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  PROHIBITED_BOOTSTRAP_PASSWORDS,
  validatePasswordPolicy,
} from '../../../core/security/AuthService';

export default function RequirePasswordChange() {
  const { currentUser, updateUserPassword, logout } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanPass = newPassword.trim();
  const cleanConfirm = confirmPassword.trim();

  // SEC-HARDENING-P1 (Batch A): Unified rule checks (8+ chars, letter + digit, not prohibited)
  const isMinLength = cleanPass.length >= 8;
  const hasLetterAndDigit = /[a-zA-Z]/.test(cleanPass) && /[0-9]/.test(cleanPass);
  const isNotProhibited = !PROHIBITED_BOOTSTRAP_PASSWORDS.has(cleanPass.toLowerCase());
  const isMatching = cleanPass.length > 0 && cleanPass === cleanConfirm;
  const isFormValid = isMinLength && hasLetterAndDigit && isNotProhibited && isMatching;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      validatePasswordPolicy(cleanPass);
    } catch (policyErr: any) {
      setErrorMsg(policyErr?.message || 'Mot de passe invalide.');
      return;
    }

    if (!isMatching) {
      setErrorMsg('La confirmation ne correspond pas au mot de passe saisi.');
      return;
    }

    const usernameOrId = currentUser?.username || currentUser?.id;
    if (!usernameOrId) {
      setErrorMsg('Session utilisateur non valide. Veuillez vous reconnecter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserPassword(usernameOrId, cleanPass);
      // Success: updateUserPassword automatically updates signed session and AuthContext state
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 text-slate-100">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Changement de mot de passe obligatoire
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Pour sécuriser votre compte et les opérations de l'usine, vous devez obligatoirement
            remplacer le mot de passe initial par un mot de passe personnel avant d'accéder à
            l'application.
          </p>
        </div>

        {/* Current User Chip */}
        {currentUser && (
          <div className="flex items-center gap-3 p-3 bg-slate-900/60 border border-slate-700/60 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm">
              {currentUser.avatar || (currentUser.name || currentUser.username || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">
                {currentUser.name || currentUser.username}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono text-slate-400">@{currentUser.username}</span>
                <span>•</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-medium text-slate-300 border border-slate-700">
                  {currentUser.role || 'UTILISATEUR'}
                </span>
              </div>
            </div>
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          </div>
        )}

        {/* Alert / Warning Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-normal">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Les mots de passe par défaut (<strong className="font-mono">admin, magasinier, viewer, tech, 1234</strong>) sont formellement rejetés.
          </span>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-normal"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="block text-xs font-medium text-slate-300 tracking-wide"
            >
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8+ caractères (lettres + chiffres)"
                className="w-full px-3.5 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm transition-all"
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="block text-xs font-medium text-slate-300 tracking-wide"
            >
              Confirmer le nouveau mot de passe
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Répétez le mot de passe"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm transition-all"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Validation Checklist */}
          <div className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  isMinLength ? 'text-emerald-400' : 'text-slate-500'
                }`}
              />
              <span className={isMinLength ? 'text-emerald-300' : 'text-slate-400'}>
                Au moins 8 caractères
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  hasLetterAndDigit ? 'text-emerald-400' : 'text-slate-500'
                }`}
              />
              <span className={hasLetterAndDigit ? 'text-emerald-300' : 'text-slate-400'}>
                Contient au moins une lettre et un chiffre
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  cleanPass.length > 0 && isNotProhibited
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                }`}
              />
              <span
                className={
                  cleanPass.length > 0 && isNotProhibited
                    ? 'text-emerald-300'
                    : 'text-slate-400'
                }
              >
                Différent des mots de passe d'initialisation (admin, 1234...)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  isMatching ? 'text-emerald-400' : 'text-slate-500'
                }`}
              />
              <span className={isMatching ? 'text-emerald-300' : 'text-slate-400'}>
                Les deux mots de passe correspondent
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-950/40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validation en cours...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Valider et accéder à l'application</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-xl transition-colors border border-transparent hover:border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
