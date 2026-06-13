import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { messageApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery, useSessionGroupsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './MessageTester.css';

interface ApiResponse {
  success: boolean;
  messageId?: string;
  batchId?: string;
  totalMessages?: number;
  statusUrl?: string;
  timestamp: string;
  error?: string;
}

const messageTypes = ['text', 'image', 'video', 'audio', 'document'] as const;

export function MessageTester() {
  const { t } = useTranslation();
  useDocumentTitle(t('messageTester.title'));
  const { canWrite } = useRole();
  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter(s => s.status === 'ready');
  const [session, setSession] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientType, setRecipientType] = useState<'personal' | 'group' | 'bulk'>('personal');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [bulkRecipients, setBulkRecipients] = useState('');
  const [messageType, setMessageType] = useState<typeof messageTypes[number]>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [concurrency, setConcurrency] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  const { data: groups = [], isLoading: loadingGroups } = useSessionGroupsQuery(
    session,
    recipientType === 'group',
  );

  useEffect(() => {
    if (sessions.length > 0 && !session) {
      setSession(sessions[0].id);
    }
  }, [sessions, session]);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].id);
    }
    if (recipientType !== 'group') {
      setSelectedGroup('');
    }
  }, [groups, selectedGroup, recipientType]);

  const handleSend = async () => {
    const targetId = recipientType === 'group' ? selectedGroup : recipient;
    if (!session || (recipientType === 'personal' && !targetId) || (recipientType === 'bulk' && !bulkRecipients.trim())) {
      return;
    }
    setIsLoading(true);
    setResponse(null);

    try {
      let result;

      if (recipientType === 'bulk') {
        const recipients = bulkRecipients
          .split(/[\n,;]/)
          .map(item => item.trim())
          .filter(Boolean)
          .slice(0, 256)
          .map(phone => phone.replace(/[^0-9]/g, '') + '@c.us');

        if (recipients.length === 0) {
          throw new Error(t('messageTester.bulkEmpty'));
        }

        const messages = recipients.map(chatId => {
          const base = { chatId, type: messageType, content: {} as any };
          if (messageType === 'text') {
            return { ...base, content: { text: content } };
          }
          if (messageType === 'image') {
            return { ...base, content: { image: { url: mediaUrl }, caption: content } };
          }
          if (messageType === 'video') {
            return { ...base, content: { video: { url: mediaUrl }, caption: content } };
          }
          if (messageType === 'audio') {
            return { ...base, content: { audio: { url: mediaUrl } } };
          }
          return { ...base, content: { document: { url: mediaUrl }, caption: content } };
        });

        result = await messageApi.sendBulk(session, messages, { concurrency });

        setResponse({
          success: true,
          batchId: result.batchId,
          totalMessages: result.totalMessages,
          statusUrl: result.statusUrl,
          timestamp: new Date().toISOString(),
        });
      } else {
        const chatId = recipientType === 'group' ? targetId : targetId.replace(/[^0-9]/g, '') + '@c.us';

        if (messageType === 'text') {
          result = await messageApi.sendText(session, chatId, content);
        } else if (messageType === 'image') {
          result = await messageApi.sendImage(session, chatId, mediaUrl, content);
        } else if (messageType === 'video') {
          result = await messageApi.sendVideo(session, chatId, mediaUrl, content);
        } else if (messageType === 'audio') {
          result = await messageApi.sendAudio(session, chatId, mediaUrl);
        } else {
          result = await messageApi.sendDocument(session, chatId, mediaUrl, content);
        }

        setResponse({
          success: !!result.messageId,
          messageId: result.messageId,
          timestamp: result.timestamp ? new Date(result.timestamp * 1000).toISOString() : new Date().toISOString(),
        });
      }
    } catch (err) {
      setResponse({
        success: false,
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : t('messageTester.sendFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingSessions) {
    return (
      <div
        className="message-tester"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="message-tester">
      <PageHeader title={t('messageTester.title')} subtitle={t('messageTester.subtitle')} />

      <div className="tester-panels">
        <div className="compose-panel">
          <h2>{t('messageTester.compose')}</h2>

          <div className="form-group">
            <label>{t('messageTester.session')}</label>
            <select value={session} onChange={e => setSession(e.target.value)}>
              {sessions.length === 0 && <option value="">{t('messageTester.noReadySessions')}</option>}
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone || t('messageTester.sessionOptionPhoneNone')})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('messageTester.recipientType')}</label>
            <div className="toggle-group">
              <button
                className={recipientType === 'personal' ? 'active' : ''}
                onClick={() => setRecipientType('personal')}
              >
                {t('messageTester.personal')}
              </button>
              <button className={recipientType === 'group' ? 'active' : ''} onClick={() => setRecipientType('group')}>
                {t('messageTester.group')}
              </button>
              <button
                className={recipientType === 'bulk' ? 'active' : ''}
                onClick={() => setRecipientType('bulk')}
              >
                {t('messageTester.bulk')}
              </button>
            </div>
          </div>

          <div className="form-group">
            {recipientType === 'group' ? (
              <>
                <label>{t('messageTester.selectGroup')}</label>
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  disabled={loadingGroups || groups.length === 0}
                >
                  {loadingGroups && <option value="">{t('messageTester.loadingGroups')}</option>}
                  {!loadingGroups && groups.length === 0 && <option value="">{t('messageTester.noGroupsFound')}</option>}
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <span className="hint">{t('messageTester.selectGroupHint')}</span>
              </>
            ) : recipientType === 'bulk' ? (
              <>
                <label>{t('messageTester.bulkRecipients')}</label>
                <textarea
                  value={bulkRecipients}
                  onChange={e => setBulkRecipients(e.target.value)}
                  placeholder={t('messageTester.bulkHint')}
                  rows={4}
                />
                <span className="hint">{t('messageTester.bulkHint')}</span>
                <div className="form-group">
                  <label>{t('messageTester.concurrency')}</label>
                  <input
                    type="number"
                    value={concurrency}
                    onChange={e => setConcurrency(Math.max(1, Math.min(10, Number(e.target.value))))}
                    min={1}
                    max={10}
                  />
                  <span className="hint">{t('messageTester.concurrencyHint')}</span>
                </div>
              </>
            ) : (
              <>
                <label>{t('messageTester.recipientPhone')}</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="+62812345678"
                />
                <span className="hint">{t('messageTester.phoneHint')}</span>
              </>
            )}
          </div>

          <div className="form-group">
            <label>{t('messageTester.messageType')}</label>
            <div className="toggle-group">
              {messageTypes.map(type => (
                <button
                  key={type}
                  className={messageType === type ? 'active' : ''}
                  onClick={() => setMessageType(type)}
                >
                  {t(`messageTester.types.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {messageType === 'text' ? (
            <div className="form-group">
              <label>{t('messageTester.messageContent')}</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={t('messageTester.messagePlaceholder')}
                rows={5}
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>{t('messageTester.mediaUrl')}</label>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/file.jpg"
                />
              </div>
              {messageType !== 'audio' && (
                <div className="form-group">
                  <label>
                    {messageType === 'document' ? t('messageTester.filename') : t('messageTester.caption')} ({t('common.optional')})
                  </label>
                  <input
                    type="text"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={messageType === 'document' ? t('messageTester.filenamePlaceholder') : t('messageTester.captionPlaceholder')}
                  />
                </div>
              )}
            </>
          )}

          <button
            className="send-btn"
            onClick={handleSend}
            disabled={
              !canWrite ||
              isLoading ||
              !session ||
              (recipientType === 'group' ? !selectedGroup : recipientType === 'bulk' ? !bulkRecipients.trim() : !recipient)
            }
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {isLoading ? t('messageTester.sending') : canWrite ? t('messageTester.send') : t('messageTester.viewOnly')}
          </button>
        </div>

        <div className="response-panel">
          <h2>{t('messageTester.responseTitle')}</h2>

          {response ? (
            <>
              <div className={`response-status ${response.success ? 'success' : 'error'}`}>
                {response.success ? (
                  <>
                    <CheckCircle size={20} />
                    <span>{t('messageTester.successLabel')}</span>
                  </>
                ) : (
                  <>
                    <XCircle size={20} />
                    <span>{t('messageTester.failedLabel')}</span>
                  </>
                )}
              </div>

              <div className="response-details">
                <div className="detail-row">
                  <span className="detail-label">{t('messageTester.response.timestamp')}</span>
                  <span className="detail-value">{response.timestamp}</span>
                </div>
                {response.messageId && (
                  <div className="detail-row">
                    <span className="detail-label">{t('messageTester.response.messageId')}</span>
                    <span className="detail-value mono">{response.messageId}</span>
                  </div>
                )}
                {response.error && (
                  <div className="detail-row">
                    <span className="detail-label">{t('messageTester.response.error')}</span>
                    <span className="detail-value" style={{ color: '#DC2626' }}>
                      {response.error}
                    </span>
                  </div>
                )}
              </div>

              <div className="response-json">
                <pre>{JSON.stringify(response, null, 2)}</pre>
              </div>
            </>
          ) : (
            <div className="response-empty">
              <p>{t('messageTester.responseEmpty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
