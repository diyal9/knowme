export function WorkflowSideStack({
  name,
  description,
  needs,
  outcomes,
  steps,
}: {
  name: string
  description: string
  needs: string[]
  outcomes: string[]
  steps: string[]
}) {
  const needItems = needs.filter(Boolean)
  const outcomeItems = outcomes.filter(Boolean)
  const stepItems = steps.filter(Boolean)

  return (
    <div className="wb-side-stack wb-side-workflow" data-testid="workflow-side">
      <section className="wb-side-block">
        <strong className="wb-side-workflow-name">{name}</strong>
        {description ? <p className="wb-side-workflow-intro">{description}</p> : null}
      </section>
      <section className="wb-side-block wb-side-workflow-io" aria-label="需要与产出">
        <div>
          <div className="wb-side-panel-head"><strong>需要</strong></div>
          <ul className="wb-flow-io-list">
            {(needItems.length ? needItems : ['按工作流说明提供材料']).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="wb-side-panel-head"><strong>产出</strong></div>
          <ul className="wb-flow-io-list">
            {(outcomeItems.length ? outcomeItems : ['可交付结果']).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
      <section className="wb-side-block is-last" aria-label="协作步骤">
        <div className="wb-side-panel-head"><strong>步骤</strong></div>
        {stepItems.length ? (
          <ol className="wb-side-step-list">
            {stepItems.map((item) => <li key={item}>{item}</li>)}
          </ol>
        ) : (
          <p className="wb-side-workflow-steps">打开对话后，步骤会随协作更新。</p>
        )}
        <p className="wb-side-hint">进度见对话 To-dos，右侧步骤只是工作流说明。</p>
      </section>
      <p className="wb-side-hint">现在可以在左侧对话推进。</p>
    </div>
  )
}
