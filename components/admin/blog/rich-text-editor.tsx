"use client"

import { useCallback, useEffect, useState } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import CharacterCount from "@tiptap/extension-character-count"
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Code,
  Minus,
  ImagePlus,
  Undo2,
  Redo2,
  RemoveFormatting,
  Unlink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isSafeLinkHref } from "@/lib/blog/content"
import { MediaPicker } from "@/components/admin/media/media-picker"
import type { MediaAsset } from "@/lib/admin/media"
import type { BlogDocNode } from "@/lib/blog/types"

/**
 * The article editor.
 *
 * Canonical content is the TipTap JSON document — never HTML. What the
 * editor can produce is exactly what lib/blog/content.ts allows and
 * components/blog/render-content.tsx renders: no raw-HTML paste-through, no
 * arbitrary node types, no style attributes. Pasted content is plain-text +
 * the marks TipTap's own paste handling recognises from the allowlisted set;
 * nothing else survives a save, because the server re-validates the whole
 * document against the same schema regardless of what the client sent.
 */

const BlogImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      path: { default: null },
      caption: { default: null },
      alt: { default: "" },
    }
  },
})

export interface RichTextEditorHandle {
  editor: Editor | null
}

export function RichTextEditor({
  initialContent,
  onUpdate,
  editable = true,
}: {
  initialContent: BlogDocNode
  onUpdate: (doc: BlogDocNode, meta: { words: number; characters: number }) => void
  editable?: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [linkPanelOpen, setLinkPanelOpen] = useState(false)
  const [linkValue, setLinkValue] = useState("")
  const [linkError, setLinkError] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<{ path: string; url: string; alt: string; caption: string } | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Kept intentionally narrow: no strikethrough, no fenced code blocks
        // (inline code only), no built-in link (configured separately below
        // with href validation). underline stays — it is bundled by default.
        strike: false,
        codeBlock: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        validate: (href) => isSafeLinkHref(href),
      }),
      BlogImageExtension.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "Yazınızı burada oluşturun…" }),
      CharacterCount,
    ],
    content: initialContent as object,
    onUpdate: ({ editor: ed }) => {
      onUpdate(ed.getJSON() as BlogDocNode, {
        words: ed.storage.characterCount?.words?.() ?? 0,
        characters: ed.storage.characterCount?.characters?.() ?? 0,
      })
    },
    editorProps: {
      attributes: {
        class:
          "prose-editor min-h-[24rem] max-w-none px-4 py-4 text-base leading-[1.75] text-ink focus:outline-none",
      },
    },
  })

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editable, editor])

  const openLinkPanel = useCallback(() => {
    if (!editor) return
    const existing = editor.getAttributes("link").href as string | undefined
    setLinkValue(existing ?? "")
    setLinkError(null)
    setLinkPanelOpen(true)
  }, [editor])

  const applyLink = useCallback(() => {
    if (!editor) return
    const trimmed = linkValue.trim()
    if (trimmed === "") {
      editor.chain().focus().unsetLink().run()
      setLinkPanelOpen(false)
      return
    }
    if (!isSafeLinkHref(trimmed)) {
      setLinkError("Yalnızca http(s):// veya / ile başlayan bağlantılara izin verilir.")
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run()
    setLinkPanelOpen(false)
  }, [editor, linkValue])

  const confirmImageInsert = useCallback((asset: MediaAsset) => {
    setImageMeta({ path: asset.objectPath, url: asset.url, alt: asset.altText ?? "", caption: "" })
    setPickerOpen(false)
  }, [])

  /**
   * Takes the finished metadata directly rather than reading `imageMeta`
   * back out of state — that state update and this insertion both happen in
   * the same dialog-confirm handler, and reading through state would insert
   * whatever the previous render captured, not the value the operator just
   * confirmed.
   */
  const insertImageWithMeta = useCallback(
    (meta: { path: string; url: string; alt: string; caption: string }) => {
      if (!editor) return
      editor
        .chain()
        .focus()
        .setImage({ src: meta.url, alt: meta.alt } as never)
        .run()
      // setImage only accepts the base extension's declared attrs at the type
      // level; path/caption are ours, so they are applied as a follow-up.
      editor.chain().updateAttributes("image", { path: meta.path, caption: meta.caption || null }).run()
      setImageMeta(null)
    },
    [editor],
  )

  if (!editor) return <div className="min-h-[24rem] animate-pulse rounded-[4px] bg-ink/[0.04]" />

  return (
    <div className="rounded-[4px] border border-ink/15 bg-ivory">
      {editable && (
        <Toolbar
          editor={editor}
          onOpenLinkPanel={openLinkPanel}
          onOpenImagePicker={() => setPickerOpen(true)}
        />
      )}

      {linkPanelOpen && (
        <div className="flex flex-wrap items-start gap-2 border-b border-ink/10 bg-shell/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="blog-link-href" className="sr-only">
              Bağlantı adresi
            </label>
            <input
              id="blog-link-href"
              type="text"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="https:// veya /magaza"
              className="min-h-9 w-full rounded-[3px] border border-ink/15 bg-ivory px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
            />
            {linkError && (
              <p role="alert" className="mt-1 text-xs text-clay">
                {linkError}
              </p>
            )}
          </div>
          <button type="button" onClick={applyLink} className="min-h-9 rounded-full bg-brand px-4 text-xs font-medium text-on-brand">
            Uygula
          </button>
          <button
            type="button"
            onClick={() => setLinkPanelOpen(false)}
            className="min-h-9 rounded-full border border-ink/15 px-4 text-xs text-ink/70"
          >
            Vazgeç
          </button>
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2 text-xs text-ink/45">
        <span aria-live="polite">
          {editor.storage.characterCount?.words?.() ?? 0} kelime · {editor.storage.characterCount?.characters?.() ?? 0} karakter
        </span>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(assets) => {
          if (assets[0]) confirmImageInsert(assets[0])
        }}
        multiple={false}
        title="Metin içine görsel ekle"
      />

      {imageMeta && (
        <ImageMetaDialog initial={imageMeta} onCancel={() => setImageMeta(null)} onConfirm={insertImageWithMeta} />
      )}
    </div>
  )
}

function ImageMetaDialog({
  initial,
  onCancel,
  onConfirm,
}: {
  initial: { path: string; url: string; alt: string; caption: string }
  onCancel: () => void
  onConfirm: (meta: { path: string; url: string; alt: string; caption: string }) => void
}) {
  const [alt, setAlt] = useState(initial.alt)
  const [caption, setCaption] = useState(initial.caption)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blog-image-meta-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="w-full max-w-sm rounded-[4px] border border-ink/10 bg-ivory p-5">
        <h2 id="blog-image-meta-title" className="font-serif text-lg text-ink">
          Görsel bilgisi
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="blog-image-alt" className="label mb-1.5 block text-olive">
              Alternatif metin <span className="text-clay">*</span>
            </label>
            <input
              id="blog-image-alt"
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              required
              className="min-h-10 w-full rounded-[3px] border border-ink/15 bg-ivory px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
            />
          </div>
          <div>
            <label htmlFor="blog-image-caption" className="label mb-1.5 block text-olive">
              Alt yazı (opsiyonel)
            </label>
            <input
              id="blog-image-caption"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-10 w-full rounded-[3px] border border-ink/15 bg-ivory px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-9 rounded-full border border-ink/15 px-4 text-xs text-ink/70">
            Vazgeç
          </button>
          <button
            type="button"
            disabled={alt.trim() === ""}
            onClick={() => onConfirm({ ...initial, alt: alt.trim(), caption: caption.trim() })}
            className="min-h-9 rounded-full bg-brand px-4 text-xs font-medium text-on-brand disabled:opacity-50"
          >
            Ekle
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-[3px] text-ink/70 transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink disabled:cursor-not-allowed disabled:opacity-35",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
        active && "bg-brand/10 text-brand",
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({
  editor,
  onOpenLinkPanel,
  onOpenImagePicker,
}: {
  editor: Editor
  onOpenLinkPanel: () => void
  onOpenImagePicker: () => void
}) {
  return (
    <div role="toolbar" aria-label="Biçimlendirme araçları" className="flex flex-wrap items-center gap-0.5 border-b border-ink/10 px-2 py-1.5">
      <ToolbarButton label="Kalın" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="İtalik" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Altı çizili" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Satır içi kod" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink/10" />

      <ToolbarButton label="Başlık 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Başlık 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink/10" />

      <ToolbarButton label="Madde işaretli liste" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Numaralı liste" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Alıntı" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink/10" />

      <ToolbarButton label="Bağlantı ekle" active={editor.isActive("link")} onClick={onOpenLinkPanel}>
        <LinkIcon className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Bağlantıyı kaldır" disabled={!editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}>
        <Unlink className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Görsel ekle" onClick={onOpenImagePicker}>
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Yatay çizgi" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink/10" />

      <ToolbarButton label="Biçimlendirmeyi temizle" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
        <RemoveFormatting className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Geri al" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Yinele" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
    </div>
  )
}
