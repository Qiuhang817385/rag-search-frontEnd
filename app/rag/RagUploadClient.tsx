'use client'

import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  ConfigProvider,
  Descriptions,
  Input,
  List,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { UploadProps } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import {
  deleteStorageObject,
  getBackendOrigin,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  postDocumentsIngest,
  ragEndpoints,
  StorageType,
} from '@/lib/rag-api'
import ChunkPreviewPanel from './ChunkPreviewPanel'

type FileItem = {
  key: string
  filename: string
  publicUrl: string
  type: StorageType
  size?: number
}

const { TextArea } = Input

export type IngestSuccess = {
  documentId: string
  textLength: number
  filename: string | null
  message: string
  chunkCount: number
  /** 后端 ingest 已写入每块 embedding，可选展示 */
  embeddingDimensions?: number
  embeddingModel?: string
  splitConfig: {
    splitter: string
    chunkSize: number
    chunkOverlap: number
  }
}

function RagUploadInner() {
  const { message } = App.useApp()
  const [text, setText] = useState('')
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IngestSuccess | null>(null)
  const [docList, setDocList] = useState<FileItem[]>([])
  const [imageList, setImageList] = useState<FileItem[]>([])
  const [uploadingType, setUploadingType] = useState<StorageType | null>(null)

  const apiBase = useMemo(() => getBackendOrigin(), [])

  const submit = useCallback(async () => {
    const body = text.trim()
    if (!body) {
      message.warning('请先粘贴文本或通过上传选择 .txt / .md 文件')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await postDocumentsIngest({
        text: body,
        filename: fileLabel ?? undefined,
      })
      const data = (await res.json().catch(() => ({}))) as
        | IngestSuccess
        | { message?: string | string[]; statusCode?: number }

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message ?? `HTTP ${res.status}`
        throw new Error(msg)
      }

      setResult(data as IngestSuccess)
      message.success('上传成功')
    } catch (e) {
      const err =
        e instanceof Error ? e.message : '请求失败，请确认后端已启动且地址正确'
      setError(err)
      message.error(err)
    } finally {
      setLoading(false)
    }
  }, [apiBase, fileLabel, message, text])

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.txt,.md,text/plain,text/markdown',
    showUploadList: true,
    maxCount: 1,
    beforeUpload: (file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const v = reader.result
        if (typeof v === 'string') {
          setText(v)
          setFileLabel(file.name)
          message.info(`已读取文件：${file.name}`)
        }
      }
      reader.onerror = () => {
        message.error('读取文件失败')
      }
      reader.readAsText(file, 'utf-8')
      return false
    },
    onRemove: () => {
      setFileLabel(null)
      return true
    },
  }

  // 上传文件到 R2
  const handleR2Upload = useCallback(
    async (file: File, type: StorageType) => {
      setUploadingType(type)
      try {
        const { uploadUrl, key, publicUrl } = await getPresignedUploadUrl(
          type,
          file.name,
          file.type || 'application/octet-stream',
        )

        // 浏览器直传 R2
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })

        if (!uploadRes.ok) {
          throw new Error(`上传失败: ${uploadRes.status}`)
        }

        const newItem: FileItem = {
          key,
          filename: file.name,
          publicUrl,
          type,
          size: file.size,
        }

        if (type === 'doc') {
          setDocList((prev) => [...prev, newItem])
        } else {
          setImageList((prev) => [...prev, newItem])
        }

        message.success(`${file.name} 上传成功`)
      } catch (e) {
        const err = e instanceof Error ? e.message : '上传失败'
        message.error(err)
      } finally {
        setUploadingType(null)
      }
    },
    [message],
  )

  // 从 R2 下载文件
  const handleDownload = useCallback(
    async (item: FileItem) => {
      try {
        const downloadUrl = await getPresignedDownloadUrl(item.type, item.key)
        window.open(downloadUrl, '_blank')
      } catch (e) {
        const err = e instanceof Error ? e.message : '获取下载链接失败'
        message.error(err)
      }
    },
    [message],
  )

  // 从 R2 删除文件
  const handleDelete = useCallback(
    async (item: FileItem) => {
      try {
        await deleteStorageObject(item.type, item.key)
        if (item.type === 'doc') {
          setDocList((prev) => prev.filter((i) => i.key !== item.key))
        } else {
          setImageList((prev) => prev.filter((i) => i.key !== item.key))
        }
        message.success(`${item.filename} 已删除`)
      } catch (e) {
        const err = e instanceof Error ? e.message : '删除失败'
        message.error(err)
      }
    },
    [message],
  )

  const docUploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: (file) => {
      handleR2Upload(file, 'doc')
      return false
    },
  }

  const imageUploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: (file) => {
      handleR2Upload(file, 'image')
      return false
    },
  }

  const renderFileList = (list: FileItem[], type: StorageType) => (
    <List
      size="small"
      dataSource={list}
      locale={{ emptyText: '暂无文件' }}
      renderItem={(item) => (
        <List.Item
          actions={[
            <Button
              key="download"
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(item)}
            >
              下载
            </Button>,
            <Button
              key="delete"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(item)}
            >
              删除
            </Button>,
          ]}
        >
          <List.Item.Meta
            title={item.filename}
            description={
              <Space>
                <Tag color={type === 'doc' ? 'blue' : 'green'}>
                  {type === 'doc' ? '文档' : '图片'}
                </Tag>
                {item.size && (
                  <Typography.Text type="secondary" className="text-xs">
                    {(item.size / 1024).toFixed(1)} KB
                  </Typography.Text>
                )}
              </Space>
            }
          />
        </List.Item>
      )}
    />
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Space orientation="vertical" size="large" className="w-full">
        <div>
          <Typography.Title level={3} className="mb-1">
            文档入库（RAG）
          </Typography.Title>
          <Typography.Text type="secondary">
            粘贴 TXT / Markdown，或上传文件；将调用{' '}
            <Typography.Text code>
              POST {ragEndpoints.documentsIngest}
            </Typography.Text>
            ，后端地址：{apiBase}
          </Typography.Text>
        </div>

        {/* R2 文件管理 */}
        <Card
          title={
            <Space>
              <span>R2 存储</span>
              <Tag color="orange">Cloudflare R2</Tag>
            </Space>
          }
          extra={
            <Space>
              <Upload {...docUploadProps}>
                <Button
                  icon={<CloudUploadOutlined />}
                  loading={uploadingType === 'doc'}
                >
                  上传文档
                </Button>
              </Upload>
              <Upload {...imageUploadProps}>
                <Button
                  icon={<CloudUploadOutlined />}
                  loading={uploadingType === 'image'}
                >
                  上传图片
                </Button>
              </Upload>
            </Space>
          }
        >
          <Space orientation="vertical" size="middle" className="w-full">
            <Card size="small" title="文档列表">
              {renderFileList(docList, 'doc')}
            </Card>
            <Card size="small" title="图片列表">
              {renderFileList(imageList, 'image')}
            </Card>
          </Space>
        </Card>

        <Card title="文档内容">
          <Space orientation="vertical" size="middle" className="w-full">
            <Upload.Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽 .txt / .md 到此处</p>
              <p className="ant-upload-hint">
                仅在浏览器内读取为纯文本后提交，不会直接 multipart 上传
              </p>
            </Upload.Dragger>

            <div>
              <Typography.Text strong className="mb-2 block">
                或直接粘贴
              </Typography.Text>
              <TextArea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="# Markdown 或纯文本..."
                autoSize={{ minRows: 10, maxRows: 22 }}
                className="font-mono text-sm"
              />
            </div>

            <Button type="primary" onClick={submit} loading={loading} block>
              提交到后端
            </Button>
          </Space>
        </Card>

        <Card
          title={
            <Space size="small">
              <span>切片逻辑可视化（仅浏览器内预览）</span>
              <Tooltip
                title={
                  <>
                    下方预览可自由改策略与 chunkSize/chunkOverlap；入库接口仍固定为
                    RecursiveCharacterTextSplitter（1000 / 150），以返回的
                    chunkCount、splitConfig 为准。
                  </>
                }
              >
                <InfoCircleOutlined className="cursor-help text-zinc-400" />
              </Tooltip>
            </Space>
          }
        >
          <ChunkPreviewPanel text={text} />
        </Card>

        {loading && (
          <div className="flex justify-center py-6">
            <Spin tip="提交中..." />
          </div>
        )}

        {error && (
          <Alert type="error" message="请求失败" description={error} showIcon />
        )}

        {result && (
          <Card title="接口返回">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="documentId">
                <Typography.Text copyable>{result.documentId}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="textLength">
                {result.textLength}
              </Descriptions.Item>
              <Descriptions.Item label="filename">
                {result.filename ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="chunkCount">
                {result.chunkCount}
              </Descriptions.Item>
              <Descriptions.Item label="splitConfig">
                <Typography.Text code className="text-xs">
                  {result.splitConfig.splitter} · chunkSize{' '}
                  {result.splitConfig.chunkSize} · chunkOverlap{' '}
                  {result.splitConfig.chunkOverlap}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="message">{result.message}</Descriptions.Item>
            </Descriptions>
            <Typography.Paragraph className="mt-4 mb-0">
              <Typography.Text type="secondary">原始 JSON</Typography.Text>
            </Typography.Paragraph>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Card>
        )}
      </Space>
    </div>
  )
}

export default function RagUploadClient() {
  return (
    <ConfigProvider locale={zhCN}>
      <App>
        <RagUploadInner />
      </App>
    </ConfigProvider>
  )
}
