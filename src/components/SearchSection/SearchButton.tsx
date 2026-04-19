interface SearchButtonProps {
  label: string
}

export function SearchButton({ label }: SearchButtonProps) {
  return (
    <button type="submit" className="secondary">
      {label}
    </button>
  )
}
