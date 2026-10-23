"use client"

import { WarningOctagonIcon } from "@phosphor-icons/react"

import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm">
      <ModalHeader
        title={title}
        icon={WarningOctagonIcon}
        className={destructive ? "[&_[data-slot=modal-icon]]:bg-destructive/10 [&_[data-slot=modal-icon]]:text-destructive" : ""}
      />
      <ModalBody className="text-sm text-muted-foreground">{description}</ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          data-autofocus
          onClick={onConfirm}
          disabled={loading}
          className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : ""}
        >
          {loading && <Spinner />}
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
