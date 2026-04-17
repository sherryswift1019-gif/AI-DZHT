import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface Props {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={cn('artifact-md', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
