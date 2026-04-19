interface CreateSectionButtonProps {
  creatingSession: boolean
  createLabel: string
  creatingLabel: string
}

export function CreateSectionButton({
  creatingSession,
  createLabel,
  creatingLabel,
}: CreateSectionButtonProps) {
  return (
    <button type="submit" className="primary" disabled={creatingSession}>
      {creatingSession ? creatingLabel : createLabel}
    </button>
  )
}
