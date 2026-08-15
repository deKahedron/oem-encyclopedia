import { QuartzTransformerPlugin } from "../types"

function isImage(line: string): boolean {
  const trimmed = line.trim()

  if (/^!\[[^\]]*\]\([^)]*\)$/.test(trimmed)) {
    return true
  }

  if (/^!\[\[[^\]]+\]\]$/.test(trimmed)) {
    return true
  }

  return false
}

/**
 * Escape pipe characters that occur inside Obsidian wikilinks.
 *
 * This is important because infobox fields are converted into
 * Markdown table cells, where an unescaped "|" would be interpreted
 * as a column separator.
 *
 * Example:
 *
 * [[University of Arcaxius|Arcaxius]]
 *
 * becomes:
 *
 * [[University of Arcaxius\|Arcaxius]]
 *
 * Quartz's ObsidianFlavoredMarkdown transformer will then correctly
 * turn the escaped pipe back into a wikilink alias.
 */
function escapeWikilinkPipes(value: string): string {
  return value.replace(
    /\[\[([^\]]+)\]\]/g,
    (_match, contents: string) => {
      const escaped = contents.replace(/(?<!\\)\|/g, "\\|")
      return `[[${escaped}]]`
    },
  )
}

function transformInfoboxBlock(block: string[]): string[] {
  const firstLine = block[0]
  const content = block.slice(1).map((line) => line.replace(/^> ?/, ""))

  const output: string[] = [firstLine]

  let currentGroup: string[] = []
  let appearances = false

  const flushGroup = () => {
    if (currentGroup.length === 0) {
      return
    }

    const rows = currentGroup.filter((line) => line.trim() !== "")

    if (rows.length === 0) {
      currentGroup = []
      return
    }

    const fieldRows = rows.filter((line) => /\s*->\s*/.test(line))

    if (fieldRows.length > 0) {
      output.push("> | Field | Value |")
      output.push("> | --- | --- |")

      for (const line of rows) {
        const match = line.match(/^(.*?)\s*->\s*(.*)$/)

        if (match) {
          const [, label, rawValue] = match

          const value = escapeWikilinkPipes(rawValue.trim())

          output.push(`> | **${label.trim()}** | ${value} |`)
        } else {
          output.push(`> ${line}`)
        }
      }
    } else {
      for (const line of rows) {
        output.push(`> ${line}`)
      }
    }

    currentGroup = []
  }

  for (const line of content) {
    const trimmed = line.trim()

    if (trimmed === "") {
      flushGroup()

      if (output[output.length - 1] !== ">") {
        output.push(">")
      }

      continue
    }

    if (isImage(trimmed)) {
      flushGroup()
      output.push(`> ${line}`)
      continue
    }

    if (trimmed.toLowerCase() === "// appearances") {
      flushGroup()
      appearances = true
      output.push("> ### Appearances")
      continue
    }

    if (appearances) {
      output.push(`> ${line}`)
      continue
    }

    currentGroup.push(line)
  }

  flushGroup()

  return output
}

export const Infobox: QuartzTransformerPlugin = () => ({
  name: "Infobox",

  textTransform(_ctx, src) {
    const lines = src.toString().split(/\r?\n/)
    const output: string[] = []

    let i = 0

    while (i < lines.length) {
      if (/^> *\[!infobox\][+-]?.*$/.test(lines[i])) {
        const block: string[] = [lines[i]]
        i++

        while (i < lines.length && /^>/.test(lines[i])) {
          block.push(lines[i])
          i++
        }

        output.push(...transformInfoboxBlock(block))
        continue
      }

      output.push(lines[i])
      i++
    }

    return output.join("\n")
  },
})