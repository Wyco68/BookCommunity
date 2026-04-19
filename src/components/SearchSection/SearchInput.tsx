interface SearchInputProps {
  value: string
  label: string
  placeholder: string
  onChange: (value: string) => void
}

export function SearchInput({ value, label, placeholder, onChange }: SearchInputProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
