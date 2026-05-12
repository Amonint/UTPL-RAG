import { RagWorkbench } from '@/components/rag-workbench'

export default function HomePage() {
  return (
    <main className="mx-auto w-[min(calc(100%-20px),960px)] px-0 py-5 md:w-[min(calc(100%-32px),960px)] md:py-8">
      <RagWorkbench />
    </main>
  )
}
