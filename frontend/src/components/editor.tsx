import {useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode} from 'react'
import {EditorContent, useEditor, type Editor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import {
	BoldIcon,
	CodeIcon,
	CodeXmlIcon,
	Heading1Icon,
	Heading2Icon,
	Heading3Icon,
	ItalicIcon,
	LinkIcon,
	ListChecksIcon,
	ListIcon,
	ListOrderedIcon,
	QuoteIcon,
	StrikethroughIcon,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Kbd} from '@/components/ui/kbd'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Separator} from '@/components/ui/separator'
import {Spinner} from '@/components/ui/spinner'
import {Tooltip} from '@/components/ui/tooltip'
import {cn} from '@/lib/utils'
import './editor.css'

// Tiptap serializes an empty doc as an empty paragraph; Vikunja stores ''.
const normalize = (html?: string | null) => (!html || html === '<p></p>' ? '' : html)

function extensions(placeholder: string) {
	return [
		StarterKit.configure({
			trailingNode: false,
			link: {openOnClick: false, autolink: true, HTMLAttributes: {rel: 'noopener noreferrer nofollow', target: '_blank'}},
		}),
		Placeholder.configure({placeholder}),
		TaskList,
		// Read-mode ticks are written to the doc by the editor's change handler below.
		TaskItem.configure({nested: true, onReadOnlyChecked: () => true}),
		Image,
	]
}

type EditorProps = {
	value: string
	/** Called with the new HTML ('' when empty). A returned promise keeps the editor busy until it settles. */
	onSave: (html: string) => unknown
	placeholder?: string
	/** Shown in read mode when there is no content. */
	emptyText?: ReactNode
	/** 'click': read view that turns into an editor on click. 'composer': always editing, clears after save. */
	mode?: 'click' | 'composer'
	/** Controlled edit state for 'click' mode (e.g. an "Edit" menu item). */
	editing?: boolean
	onEditingChange?: (editing: boolean) => void
	/** Click mode only: disable click-to-edit (editing can still be driven by `editing`). */
	clickToEdit?: boolean
	readOnly?: boolean
	saveLabel?: string
	className?: string
	autoFocus?: boolean
}

export function RichTextEditor({
	value,
	onSave,
	placeholder = 'Write something…',
	emptyText,
	mode = 'click',
	editing: editingProp,
	onEditingChange,
	clickToEdit = true,
	readOnly,
	saveLabel,
	className,
	autoFocus,
}: EditorProps) {
	const composer = mode === 'composer'
	const [editingState, setEditingState] = useState(false)
	const editing = !readOnly && (composer || (editingProp ?? editingState))
	const [busy, setBusy] = useState(false)
	const [empty, setEmpty] = useState(!normalize(value))
	const valueRef = useRef(value)
	valueRef.current = value
	const onSaveRef = useRef(onSave)
	onSaveRef.current = onSave

	const editor = useEditor({
		extensions: extensions(placeholder),
		content: value,
		editable: composer,
		shouldRerenderOnTransaction: true,
		autofocus: composer && autoFocus ? 'end' : false,
		onUpdate: ({editor}) => {
			setEmpty(editor.isEmpty)
			// Checklist toggles in read mode save straight away.
			if (editor.isEditable || readOnly) return
			const html = normalize(editor.getHTML())
			if (html !== normalize(valueRef.current)) onSaveRef.current(html)
		},
	})

	const setEditing = (next: boolean) => {
		if (editingProp === undefined) setEditingState(next)
		onEditingChange?.(next)
	}

	useEffect(() => {
		if (!editor || composer) return
		editor.setEditable(editing && !readOnly, false)
		if (editing) editor.commands.focus('end')
	}, [editor, editing, composer, readOnly])

	// Follow outside changes while not editing.
	useEffect(() => {
		if (!editor || editing) return
		if (normalize(editor.getHTML()) !== normalize(value)) {
			editor.commands.setContent(value || '', {emitUpdate: false})
			setEmpty(editor.isEmpty)
		}
	}, [editor, value, editing])

	const cancel = () => {
		if (!editor) return
		editor.commands.setContent(valueRef.current || '', {emitUpdate: false})
		setEmpty(editor.isEmpty)
		if (!composer) setEditing(false)
	}

	const save = async () => {
		if (!editor || busy) return
		const html = editor.isEmpty ? '' : normalize(editor.getHTML())
		if (composer && !html) return
		if (!composer && html === normalize(valueRef.current)) {
			setEditing(false)
			return
		}
		setBusy(true)
		try {
			await onSaveRef.current(html)
			if (composer) {
				editor.commands.clearContent(true)
			} else {
				setEditing(false)
			}
		} catch {
			// The caller reports the error; keep the draft.
		} finally {
			setBusy(false)
		}
	}

	const onKeyDown = (e: KeyboardEvent) => {
		if (!editing) return
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			void save()
		} else if (e.key === 'Escape' && !composer) {
			e.preventDefault()
			e.stopPropagation()
			cancel()
		}
	}

	// The task item node view only flips the DOM checkbox in read mode; mirror it into the doc so it saves.
	const onCheckboxChange = (e: Event) => {
		if (!editor || editor.isEditable || readOnly) return
		const input = e.target as HTMLInputElement
		const content = input.closest('ul[data-type="taskList"] > li')?.querySelector(':scope > div')
		if (input.type !== 'checkbox' || !content) return
		const $pos = editor.state.doc.resolve(editor.view.posAtDOM(content, 0))
		for (let d = $pos.depth; d > 0; d--) {
			const node = $pos.node(d)
			if (node.type.name !== 'taskItem') continue
			editor.view.dispatch(editor.state.tr.setNodeMarkup($pos.before(d), undefined, {...node.attrs, checked: input.checked}))
			return
		}
	}
	const checkboxHandler = useRef(onCheckboxChange)
	checkboxHandler.current = onCheckboxChange
	const readRef = useRef<HTMLDivElement>(null)
	// Native listener: React's onChange doesn't see checkboxes it didn't render.
	useEffect(() => {
		const el = readRef.current
		if (!el) return
		const handler = (e: Event) => checkboxHandler.current(e)
		el.addEventListener('change', handler)
		return () => el.removeEventListener('change', handler)
	}, [])

	const onReadClick = (e: MouseEvent) => {
		if (editing || readOnly || !clickToEdit || composer || !editor) return
		const target = e.target as HTMLElement
		if (target.closest('a, input, label, button')) return
		if (window.getSelection()?.toString()) return
		const pos = editor.view.posAtCoords({left: e.clientX, top: e.clientY})
		setEditing(true)
		if (pos) requestAnimationFrame(() => editor.chain().focus().setTextSelection(pos.pos).run())
	}

	const showEmpty = !editing && empty && !composer
	// An idle composer stays a slim box until it is focused or holds a draft.
	const expanded = !composer || !empty || !!editor?.isFocused

	return (
		<div className={cn('group/editor', className)} onKeyDown={onKeyDown}>
			<div
				ref={readRef}
				onClick={onReadClick}
				className={cn(
					editing
						? 'rounded-lg border bg-background shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50'
						: '-mx-2 rounded-lg px-2 py-1.5',
					!editing && !readOnly && clickToEdit && !composer && 'cursor-text transition-colors hover:bg-muted/50',
				)}
			>
				{editing && editor && expanded && <Toolbar editor={editor} />}
				{showEmpty && (
					<p className="text-sm text-muted-foreground">{emptyText ?? (readOnly ? 'Nothing here.' : placeholder)}</p>
				)}
				<EditorContent
					editor={editor}
					className={cn(
						'rich-text',
						editing && 'max-h-[60vh] overflow-y-auto px-3 py-2.5',
						expanded && editing && '[&_.ProseMirror]:min-h-16',
						showEmpty && 'hidden',
					)}
				/>
				{editing && expanded && (
					<div className="flex items-center justify-end gap-2 border-t px-2 py-1.5">
						<span className="mr-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
							<Kbd>⌘</Kbd>
							<Kbd>Enter</Kbd>
							<span>to save</span>
						</span>
						{(!composer || !empty) && (
							<Button size="sm" onClick={cancel} disabled={busy}>
								{composer ? 'Clear' : 'Cancel'}
							</Button>
						)}
						<Button tone="primary" size="sm" onClick={() => void save()} disabled={busy || (composer && empty)}>
							{busy && <Spinner />}
							{saveLabel ?? (composer ? 'Comment' : 'Save')}
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}

/** Read-only rendering. Pass onChange to let checklist items be ticked. */
export function RichTextView({html, onChange, className}: {html: string; onChange?: (html: string) => unknown; className?: string}) {
	return (
		<RichTextEditor
			value={html}
			onSave={html => onChange?.(html)}
			readOnly={!onChange}
			clickToEdit={false}
			emptyText=""
			className={className}
		/>
	)
}

function ToolButton({
	label,
	active,
	onClick,
	children,
}: {
	label: string
	active?: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<Tooltip
			label={label}
			aria-pressed={active}
			onMouseDown={e => e.preventDefault()}
			onClick={onClick}
			className={cn('text-muted-foreground', active && 'bg-muted text-foreground')}
		>
			{children}
		</Tooltip>
	)
}

function Toolbar({editor}: {editor: Editor}) {
	const chain = () => editor.chain().focus()
	return (
		<div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
			<ToolButton label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
				<BoldIcon />
			</ToolButton>
			<ToolButton label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
				<ItalicIcon />
			</ToolButton>
			<ToolButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}>
				<StrikethroughIcon />
			</ToolButton>
			<ToolButton label="Inline code" active={editor.isActive('code')} onClick={() => chain().toggleCode().run()}>
				<CodeIcon />
			</ToolButton>
			<Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
			<ToolButton
				label="Heading 1"
				active={editor.isActive('heading', {level: 1})}
				onClick={() => chain().toggleHeading({level: 1}).run()}
			>
				<Heading1Icon />
			</ToolButton>
			<ToolButton
				label="Heading 2"
				active={editor.isActive('heading', {level: 2})}
				onClick={() => chain().toggleHeading({level: 2}).run()}
			>
				<Heading2Icon />
			</ToolButton>
			<ToolButton
				label="Heading 3"
				active={editor.isActive('heading', {level: 3})}
				onClick={() => chain().toggleHeading({level: 3}).run()}
			>
				<Heading3Icon />
			</ToolButton>
			<Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
			<ToolButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>
				<ListIcon />
			</ToolButton>
			<ToolButton
				label="Numbered list"
				active={editor.isActive('orderedList')}
				onClick={() => chain().toggleOrderedList().run()}
			>
				<ListOrderedIcon />
			</ToolButton>
			<ToolButton label="Checklist" active={editor.isActive('taskList')} onClick={() => chain().toggleTaskList().run()}>
				<ListChecksIcon />
			</ToolButton>
			<Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
			<LinkButton editor={editor} />
			<ToolButton label="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}>
				<QuoteIcon />
			</ToolButton>
			<ToolButton label="Code block" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()}>
				<CodeXmlIcon />
			</ToolButton>
		</div>
	)
}

function LinkButton({editor}: {editor: Editor}) {
	const [open, setOpen] = useState(false)
	const [href, setHref] = useState('')
	const apply = () => {
		const url = href.trim()
		const chain = editor.chain().focus().extendMarkRange('link')
		if (!url) chain.unsetLink().run()
		else chain.setLink({href: /^[a-z][\w+.-]*:/i.test(url) ? url : `https://${url}`}).run()
		setOpen(false)
	}
	return (
		<Popover
			open={open}
			onOpenChange={o => {
				if (o) setHref((editor.getAttributes('link').href as string | undefined) ?? '')
				setOpen(o)
			}}
		>
			<Tooltip
				label="Link"
				render={
					<PopoverTrigger
						onMouseDown={e => e.preventDefault()}
						className={cn('text-muted-foreground', editor.isActive('link') && 'bg-muted text-foreground')}
					/>
				}
			>
				<LinkIcon />
			</Tooltip>
			<PopoverContent className="w-80 p-2" align="start">
				<form
					className="flex gap-2"
					onSubmit={e => {
						e.preventDefault()
						apply()
					}}
				>
					<Input autoFocus placeholder="https://…" value={href} onChange={e => setHref(e.target.value)} className="h-8" />
					<Button type="submit" tone="primary" size="sm">
						{href.trim() ? 'Apply' : 'Remove'}
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	)
}
