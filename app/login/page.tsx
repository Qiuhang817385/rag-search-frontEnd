'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Alert, Button, ConfigProvider, Form, Input, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { login } from '@/app/actions/auth'

const { Title, Text } = Typography

type LoginField = {
  email: string
  password: string
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, { error: '' })

  const onFinish = (values: LoginField) => {
    const fd = new FormData()
    fd.set('email', values.email.trim())
    fd.set('password', values.password)
    formAction(fd)
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 px-4">
        <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-md">
          <Title level={3} className="mb-6! text-center">
            登录
          </Title>

          {state.error ? (
            <Alert
              type="error"
              showIcon
              className="mb-4"
              message={state.error}
              closable
            />
          ) : null}

          <Form<LoginField>
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            disabled={isPending}
          >
            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            >
              <Input placeholder="name@example.com" autoComplete="email" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                placeholder="密码"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item className="mb-2!">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={isPending}
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" className="block text-center text-sm">
            没有账号？{' '}
            {/* <Link href="/register" className="text-[#1677ff] hover:underline">
              去注册
            </Link> */}
          </Text>
        </div>
      </div>
    </ConfigProvider>
  )
}
