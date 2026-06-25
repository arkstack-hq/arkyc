import * as day from 'dayjs'

import { Hash, Logger } from '@arkstack/common'

import { AdminGrantCommand } from './AdminGrantCommand'
import { Command } from '@h3ravel/musket'
import { PersonalAccessToken } from 'src/app/models/PersonalAccessToken'
import { User } from 'src/app/models/User'
import { UserTwoFactor } from 'src/app/models/UserTwoFactor'
import { interopDefault } from '@arkstack/common'
import { perPage } from '@arkstack/common'

const dayjs = interopDefault(day)

export class UsersCommand extends Command {
  signature = `users
        {userId? : The ID|Email addres of the user to manage, will prompt if not provided)}
        {--p|perPage=20 : Number of users to show per page when prompting.}
        {--s|search? : Search term for filtering users.}
        {--a|accountType? : Filter users by account type.}
    `

  description = 'Manage users through an interactive prompt'

  async handle() {
    let userId: string | undefined = this.argument('userId')
    const search = this.option('search')
    const accountType = this.option('accountType')

    if (!userId) {
      let page = 1

      while (!userId) {
        const data = await this.fetchUsers(page, perPage(this.options()), search, accountType)

        const choices = data.data.all().map((user) => ({
          name: `${user.getAttribute('name')}`.trim(),
          value: user.id,
        }))

        if (page > 1) {
          choices.unshift({
            name: Logger.log('← Previous Page', 'green', false),
            value: 'previous',
          })
        }

        if (data.meta.currentPage < data.meta.lastPage) {
          choices.push({
            name: Logger.log('Next Page →', 'green', false),
            value: 'next',
          })
        }

        choices.push({
          name: Logger.log('✖ Exit', 'red', false),
          value: 'exit',
        })

        const selected = await this.choice(
          `Choose a user to manage (page ${data.meta.currentPage} of ${data.meta.lastPage}):`,
          choices,
        )

        if (selected === 'next') {
          page += 1
          continue
        }

        if (selected === 'previous') {
          page -= 1
          continue
        }

        if (selected === 'exit') {
          Logger.info('Exiting user management.', true)

          return
        }

        userId = selected
      }
    }

    if (userId) {
      const user = await User.query()
        .when(!userId.includes('@'), (e) => e.where({ id: userId }))
        .when(userId.includes('@'), (e) => e.where({ email: userId }))
        .firstOrFail()

      const action = await this.choice(`Selected user: ${user.getAttribute('name')}. Choose an action:`, [
        { name: 'Details', value: 'view' },
        { name: 'Edit', value: 'edit' },
        { name: 'Send Notification', value: 'notify' },
        { name: 'Make Admin', value: 'adminize' },
        { name: 'Delete User', value: 'delete' },
        { name: Logger.log('✖ Exit', 'red', false), value: 'exit' },
      ])

      if (action === 'view') {
        await this.viewUser(user)
      } else if (action === 'delete') {
        await this.deleteUser(user)
      } else if (action === 'notify') {
        // const handler = new SendTestNotification(this.app, this.kernel)
        // handler.setInput([], [user.id], [new Argument('userId')], {}, this.program)
        // await handler.handle()
        this.info('Not Implemented')
      } else if (action === 'adminize') {
        const cmd = new AdminGrantCommand(this.app, this.kernel)
        cmd.setArgument('email', user.email)
        await cmd.handle()
      } else if (action === 'edit') {
        await this.editUser(user)
      }
    }
  }

  async fetchUsers(page = 1, perPage = 20, search?: string, accountType?: string) {
    const data = await User.query()
      .when(search, (e) =>
        e.whereRaw(
          `
                    LOWER("firstname") LIKE ? OR
                    LOWER("lastname") LIKE ? OR
                    CONCAT_WS(' ', LOWER("firstname"), LOWER("lastname")) LIKE ?
                `,
          Array(3).fill(`%${String(search).toLowerCase()}%`),
        ),
      )
      .when(accountType, (e) => e.where({ accountType }))
      .select({
        id: true,
        firstName: true,
        lastName: true,
      })
      .paginate(perPage, page)

    if (data.meta.total < 1) {
      Logger.error('No users found.', true)
    }

    return data
  }

  async editUser(user: User) {
    const fields = [
      'First Name',
      'Last Name',
      'Date Of Birth',
      'Email',
      'Phone',
      'Password',
      Logger.log('✖ Exit', 'red', false),
    ]
    let field = await this.choice('Which field do you want to edit?', fields)

    do {
      if (field.includes('Exit')) {
        Logger.info('Exiting edit mode.', true)
      }

      const key = str(field).camel().value()
      const def = user.getAttribute(key) as string

      if (key) {
        const val =
          field === 'Password'
            ? await Hash.make(await this.secret(`Enter new value for ${field}:`, '*'))
            : await this.ask(`Enter new value for ${field}:`, def)

        if (val) {
          await user.fill({ [key]: val }).save()
          this.success(`${field} updated successfully.`)
        } else {
          this.error('No value entered. Update cancelled.')
        }
      } else {
        this.error('No field selected. Update cancelled.')
      }

      field = await this.choice('Which field do you want to edit?', fields)
    } while (!field.includes('Exit'))
  }

  async viewUser(user: User) {
    const [session, twoFa] = await Promise.all([
      PersonalAccessToken.query().where({ userId: user.id }).latest('lastUsedAt').first(),
      UserTwoFactor.query().where({ userId: user.id }).first(),
    ])

    const fields: Array<[string, string]> = [
      ['ID', String(user.id)],
      ['Name', String(user.getAttribute('name'))],
      ['Email', String(user.getAttribute('email'))],
      ['Phone', String(user.getAttribute('phone') || 'N/A')],
      ['Avatar URL', String(user.getAttribute('avatarUrl') || 'N/A')],
      ['Two-Factor Method', String(twoFa?.method || 'N/A')],
      ['Two-Factor Enabled At', twoFa?.enabledAt ? dayjs(twoFa.enabledAt).format('YYYY-MM-DD h:mm A') : 'N/A'],
      ['Created At', dayjs(user.createdAt).format('YYYY-MM-DD h:mm A')],
      ['Last Login', dayjs(session?.lastUsedAt ?? new Date()).format('YYYY-MM-DD h:mm A')],
    ]

    console.log(
      fields
        .map(([label, value]) =>
          Logger.log(
            [
              [label, ['cyan', 'bold']],
              [`${value}`, 'white'],
            ],
            ': ',
            false,
          ),
        )
        .join('\n'),
    )
  }

  async deleteUser(user: User) {
    const confirm = await this.confirm(
      `Are you sure you want to delete user ${user.name}? This action cannot be undone.`,
      false,
    )

    if (confirm) {
      await User.query().where({ id: user.id }).delete()
      Logger.success(`User ${user.name} has been deleted.`, true)
    } else {
      Logger.info('User deletion cancelled.', true)
    }
  }
}
