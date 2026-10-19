import SequentialCodePicker from './SequentialCodePicker';

/**
 * UserCodePicker
 * 
 * Specialized wrapper around the generic SequentialCodePicker for user profiles
 * (Technicians 'TECH-', Operators 'OP-', Supervisors/Responsables 'RESP-').
 */
export default function UserCodePicker(props) {
  return (
    <SequentialCodePicker
      prefix={props.prefix || 'TECH-'}
      label={props.label || 'Code Utilisateur'}
      helperText={
        props.helperText ||
        'Généré automatiquement selon le profil avec choix libre de numéro (01-99)'
      }
      {...props}
    />
  );
}

export { SequentialCodePicker };
