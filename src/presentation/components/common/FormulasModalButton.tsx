import FxFormulaIcon from './icons/FxFormulaIcon';
import Action3DButton from './Action3DButton';

/**
 * FormulasModalButton — Standardized 3D Excel Formulas Circular Trigger Button
 * Displays the professional Excel 'fx' icon with green 'f' and black 'x'.
 * Enforces Excel emerald green theme for border, hover state, and shadows across all pages.
 * 
 * @param {Object} props
 * @param {function} props.onClick - Function to open the Excel formulas modal
 * @param {string} [props.title="Formules Excel (Miroir GMAO)"] - Tooltip text
 * @param {string} [props.color] - Optional color (defaults and locks to emerald)
 * @param {string} [props.className=""] - Extra CSS classes
 */
export default function FormulasModalButton({
  onClick,
  title = "Formules Excel (Miroir GMAO)",
  color: _color = "emerald",
  className = "",
}) {
  return (
    <Action3DButton
      variant="circle"
      color="emerald"
      icon={FxFormulaIcon}
      onClick={onClick}
      title={title}
      ariaLabel="Afficher les formules Excel"
      className={`hover:border-emerald-400 hover:bg-emerald-50/80 hover:shadow-[0_4px_14px_rgba(16,185,129,0.22)] active:border-emerald-500 ${className}`.trim()}
    />
  );
}
