'use strict'

const args = process.argv.slice(2)
const command = args.join(' ')

function write(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

if (process.env.KNOWME_FEISHU_FIXTURE_FAILURE === '1') {
  process.stderr.write('fixture authorization failure\n')
  process.exit(1)
}

if (command.includes('auth status')) {
  write({ identities: { user: { status: 'ready', tokenStatus: 'valid', userName: '资格夹具用户', openId: 'ou_fixture' } } })
} else if (command.includes('calendar +agenda')) {
  write({ data: { events: [{ summary: '发布验收回归', start_time: '2026-09-09T14:00:00+08:00', end_time: '2026-09-09T15:00:00+08:00', status: 'accepted' }] } })
} else if (command.includes('task +get-my-tasks')) {
  write({ data: { items: [{ id: 'task-fixture-1', title: '核对发布验收标准', due: '2026-09-09T12:00:00+08:00', completed: false, url: 'https://example.invalid/task-fixture-1' }] } })
} else if (command.includes('im +messages-search')) {
  write({ data: { messages: [{ message_id: 'message-fixture-1', chat_id: 'oc_fixture', text: '请确认发布验收标准，今天下班前反馈。', create_time: '2026-09-09T09:30:00+08:00', sender_name: '项目群成员' }] } })
} else if (command.includes('im +chat-list')) {
  write({ data: { items: [{ chat_id: 'oc_fixture', name: '发布项目群', chat_type: 'group', active_time: '2026-09-09T09:30:00+08:00' }] } })
} else if (command.includes('vc +search')) {
  write({ data: { items: [{ id: 'meeting-fixture-1', display_info: '发布验收评审\n2026-09-09 14:00 | 组织者：项目经理', meta_data: { app_link: 'https://example.invalid/meeting-fixture-1' } }] } })
} else if (command.includes('vc +detail')) {
  write({ data: { meetings: [{ id: 'meeting-fixture-1', topic: '发布验收评审', start_time: '2026-09-09 14:00', minute_token: 'minute-fixture-1' }] } })
} else if (command.includes('drive files list')) {
  write({ data: { items: [{ token: 'fld_fixture', name: '项目资料', type: 'folder' }] } })
} else if (command.includes('drive +search')) {
  write({ data: { items: [{ docs_token: 'doc-fixture-1', title: '发布验收标准', type: 'docx', url: 'https://example.invalid/doc-fixture-1', edit_time: '2026-09-08T16:00:00+08:00' }] } })
} else if (command.includes('wiki +space-list')) {
  write({ data: { items: [{ space_id: 'space-fixture-1', name: '项目知识库' }] } })
} else {
  write({ data: { items: [] } })
}
