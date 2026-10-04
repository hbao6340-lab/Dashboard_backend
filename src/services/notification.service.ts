// Central notification service: creates the in-app notification row and
// mirrors it to the user's email (no-reply). All controllers should use
// notifyUser() instead of writing to prisma.notification directly.
import { prisma } from '../config/prisma.js'
import { sendEmail } from './mail.service.js'

interface NotifyInput {
  userId: string
  type: any
  title: string
  message: string
  relatedId?: string
  relatedType?: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function notifyUser(input: NotifyInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedId: input.relatedId,
      relatedType: input.relatedType,
    },
  })

  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, fullName: true },
    })
    if (user?.email) {
      const subject = `[Đoàn Tân Hưng] ${input.title}`
      const text =
        `Xin chào ${user.fullName},\n\n${input.message}\n\n` +
        `Vui lòng đăng nhập hệ thống để xem chi tiết.\n\n` +
        `---\nĐây là email tự động, vui lòng không trả lời (do-not-reply).`
      const html =
        `<p>Xin chào <b>${escapeHtml(user.fullName)}</b>,</p>` +
        `<p>${escapeHtml(input.message)}</p>` +
        `<p>Vui lòng đăng nhập hệ thống để xem chi tiết.</p>` +
        `<hr><p style="color:#888;font-size:12px;">Đây là email tự động, vui lòng không trả lời (do-not-reply).</p>`
      sendEmail(user.email, subject, text, html)
    }
  } catch (err: any) {
    console.warn(`📧 Email mirror failed for user ${input.userId}: ${err?.message || err}`)
  }

  return notification
}
