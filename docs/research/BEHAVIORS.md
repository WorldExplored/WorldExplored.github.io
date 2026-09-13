# Behaviors

## Navigation
Anchors carry stable section hashes. On desktop, enhanced activation pushes a hash state and opens a native dialog; on mobile it scrolls to the corresponding section. Hashchange/popstate reconcile state. Back/Forward restore prior section or habitat. Direct hash loads work at every width. Unknown hashes do not open dialogs.

## Dialogs
Native showModal supplies top-layer modality and inert background. Initial focus is the close control; Tab and Shift+Tab remain within the dialog. Escape, close, minimize and backdrop click dismiss. Focus restores to the initiating control; direct entry restores to the matching dock item. Body scrolling is locked while open. A section switcher remains inside the modal.

## Visual states
Buttons: 180ms color/shadow and 0.98 press scale. Landmark label: subtle upward highlight on hover, with a distinct dark focus ring. Opening: 220ms opacity/translate. No input is blocked during animation.

## Environment
Slow decorative bubble drift and water glint; pointer depth response limited to a few pixels. All content is visible by default. A motion toggle allows immediate pause. prefers-reduced-motion, save-data and document visibility pause ambient work. Ambient motion pauses while a dialog is open.

## Verification
Browser screenshots and behavior findings belong in docs/qa/ITERATION_LOG.md. Focus/history checks test the built static export, not only the development server.
