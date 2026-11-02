// Chat log and edit list rendering (U-4, U-5).
var BL = window.BL = window.BL || {};

BL.createChatView = ({ log, editList, editCount, onRevert, modelName = () => 'reflective mind' }) => {
  const LABELS = {
    // jev: chat entries saved before the auto-mind rename
    user: 'you', inhabitant: 'inhabitant', 'auto-mind': 'Jev', jev: 'Jev',
    edit: 'world edit', run: 'run once', memory: 'memory', 'core-request': 'core change request', error: 'error', system: 'system',
  };

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const appendMessage = (entry) => {
    const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const msg = el('div', `msg msg-${entry.kind}`);
    msg.append(el('span', 'msg-meta', `${entry.kind === 'reflective-mind-thought' ? modelName() : LABELS[entry.kind] || entry.kind} · ${time(entry.at)} · tick ${entry.tick}`));
    msg.append(document.createTextNode(entry.text));
    log.append(msg);
    if (stick) log.scrollTop = log.scrollHeight;
  };

  const renderChat = (entries) => {
    log.replaceChildren();
    entries.forEach(appendMessage);
    log.scrollTop = log.scrollHeight;
  };

  const renderEdits = (editLog, currentVersion, snapshotVersions) => {
    editList.replaceChildren();
    editCount.textContent = editLog.length ? `(${editLog.length})` : '';
    for (const e of [...editLog].reverse()) {
      const li = el('li', `edit${e.version === currentVersion ? ' current' : ''}`);
      li.append(el('div', 'edit-head', `v${e.version} · ${e.author} · ${time(e.at)} · tick ${e.tick}`));
      li.append(el('div', 'edit-comment', e.comment));
      const touched = [...(e.names || []), ...(e.deleted || []).map(n => `−${n}`)];
      li.append(el('div', 'edit-names', touched.join(', ')));
      const btn = el('button', 'btn', e.version === currentVersion ? 'current' : 'revert to here');
      btn.disabled = e.version === currentVersion || !snapshotVersions.has(e.version);
      btn.addEventListener('click', () => onRevert(e.version));
      li.append(btn);
      editList.append(li);
    }
  };

  return { appendMessage, renderChat, renderEdits };
};
