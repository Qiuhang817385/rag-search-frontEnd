'use client'

import Link from 'next/link'
import { startTransition, useActionState } from 'react'
import {
  Alert,
  Button,
  ConfigProvider,
  Form,
  Input,
  Typography,
} from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { register } from '@/app/actions/auth'

const { Title, Text, Paragraph } = Typography

type RegisterField = {
  name?: string
  email: string
  password: string
  confirmPassword: string
}

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(register, { error: '' })

  const onFinish = (values: RegisterField) => {
    const fd = new FormData()
    fd.set('email', values.email.trim())
    fd.set('password', values.password)
    const name = values.name?.trim()
    if (name) fd.set('name', name)
    startTransition(() => {
      formAction(fd)
    })
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 px-4 py-10">
        <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-md">
          <Title level={3} className="mb-1! text-center">
            注册
          </Title>
          <Paragraph type="secondary" className="mb-6! text-center text-sm">
            密码至少 8 位；注册成功后将跳转到登录页
          </Paragraph>

          {state.error ? (
            <Alert
              type="error"
              showIcon
              className="mb-4"
              message={state.error}
              closable
            />
          ) : null}

          <Form<RegisterField>
            layout="vertical"
            requiredMark="optional"
            onFinish={onFinish}
            disabled={isPending}
          >
            <Form.Item label="昵称" name="name">
              <Input placeholder="选填，便于展示" maxLength={100} showCount />
            </Form.Item>

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
              rules={[
                { required: true, message: '请设置密码' },
                { min: 8, message: '密码至少 8 位' },
                { max: 128, message: '密码过长' },
              ]}
              extra="与后端校验一致：8～128 位"
            >
              <Input.Password
                placeholder="至少 8 位"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              label="确认密码"
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'))
                  },
                }),
              ]}
            >
              <Input.Password
                placeholder="再次输入密码"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item className="mb-2!">
              <Button type="primary" htmlType="submit" block loading={isPending}>
                注册
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" className="block text-center text-sm">
            已有账号？{' '}
            <Link href="/login" className="text-[#1677ff] hover:underline">
              去登录
            </Link>
          </Text>
        </div>
      </div>
    </ConfigProvider>
  )
}
