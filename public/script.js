/* DASHBOARD.EXE — Progressive Enhancement Script */
'use strict';
(function () {
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

  function ajax(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['X-Requested-With'] = 'XMLHttpRequest';
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- Dynamic Clock (Status Bar) ---
  var dtEl = $('#status-datetime');
  if (dtEl) {
    function updateClock() {
      var now = new Date();
      var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      dtEl.textContent = months[now.getMonth()] + ' ' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        now.getFullYear() + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  // --- Theme Toggle ---
  var themeForm = $('#theme-form');
  if (themeForm) {
    themeForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var themeInput = $('#theme-input');
      var themeBtn = $('#theme-btn');
      var isDark = themeInput.value === 'dark'; // true means we are switching TO dark
      themeInput.value = isDark ? 'light' : 'dark';
      themeBtn.textContent = isDark ? '☀️' : '🌙';
      if (isDark) {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.remove('theme-dark');
      }
      ajax('/settings/theme', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'theme=' + (isDark ? 'dark' : 'light')
      }).catch(function(){});
    });
  }

  // --- SYS_RESOURCES Live Update ---
  var sysUptimeEl = $('#sys-uptime');
  var statusUptimeEl = $('#status-uptime');
  var statusMemEl = $('#status-mem');
  var memBarEl = $('#mem-bar');
  var memPctEl = $('#mem-pct');
  var heapBarEl = $('#heap-bar');
  var heapPctEl = $('#heap-pct');
  var chatUptimeEl = $('#chat-uptime');

  function updateSysInfo() {
    ajax('/api/sysinfo').then(function (d) {
      var ut = String(d.uptimeHours).padStart(2,'0') + ':' + String(d.uptimeMinutes).padStart(2,'0') + ':' + String(d.uptimeSeconds).padStart(2,'0');
      if (sysUptimeEl) sysUptimeEl.textContent = ut;
      if (statusUptimeEl) statusUptimeEl.textContent = ut;
      if (chatUptimeEl) chatUptimeEl.textContent = ut;
      if (statusMemEl) statusMemEl.textContent = d.memoryUsedMB;
      if (memPctEl) memPctEl.textContent = d.memoryUsedMB + 'MB';
      if (heapPctEl) heapPctEl.textContent = d.heapUsedMB + '/' + d.heapTotalMB + 'MB';
      if (heapBarEl && d.heapTotalMB > 0) {
        heapBarEl.style.width = Math.min(100, Math.round(d.heapUsedMB / d.heapTotalMB * 100)) + '%';
      }
    }).catch(function () {});
  }
  if (sysUptimeEl || statusUptimeEl) {
    updateSysInfo();
    setInterval(updateSysInfo, 10000);
  }

  // --- Calendar Render ---
  var calMonthText = $('#cal-month-text');
  var calGrid = $('#calendar-grid');
  var calPrev = $('#cal-prev');
  var calNext = $('#cal-next');
  
  if (calMonthText && calGrid) {
    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    var currentMonth = currentDate.getMonth();
    window.updateCalendarView = function() {
      if (typeof renderCalendar === 'function') renderCalendar(currentYear, currentMonth);
    };

    function renderCalendar(year, month) {
      var todayDate = new Date();
      var isCurrentMonth = (year === todayDate.getFullYear() && month === todayDate.getMonth());
      var today = todayDate.getDate();
      
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var firstDay = new Date(year, month, 1).getDay();
      var daysInPrev = new Date(year, month, 0).getDate();

      var monthNames = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
      calMonthText.textContent = monthNames[month] + ' ' + year;

      var dayHeaders = ['SU','MO','TU','WE','TH','FR','SA'];
      var html = '';
      dayHeaders.forEach(function(d) { html += '<div class="day-header">' + d + '</div>'; });

      for (var i = firstDay - 1; i >= 0; i--) {
        html += '<div class="day other-month">' + (daysInPrev - i) + '</div>';
      }
      for (var d = 1; d <= daysInMonth; d++) {
        var cls = (isCurrentMonth && d === today) ? 'day today' : 'day';
        var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var dayEvents = window.calendarEvents ? window.calendarEvents.filter(function(ev) { return ev.date === dateStr; }) : [];
        var eventDot = dayEvents.length > 0 ? '<div style="width:4px;height:4px;background:#f00;border-radius:50%;margin:2px auto 0;"></div>' : '';
        var tooltip = dayEvents.length > 0 ? dayEvents.map(function(ev) { return ev.title.replace(/"/g, '&quot;'); }).join(', ') : '';
        html += '<div class="' + cls + '" data-date="' + dateStr + '" style="cursor:pointer;" title="' + tooltip + '">' + d + eventDot + '</div>';
      }
      var remaining = 42 - (firstDay + daysInMonth);
      for (var i = 1; i <= remaining; i++) {
        html += '<div class="day other-month">' + i + '</div>';
      }
      calGrid.innerHTML = html;

      // Add click listeners to active days
      $$('.day[data-date]', calGrid).forEach(function(dayEl) {
        dayEl.addEventListener('click', function() {
          var dt = dayEl.dataset.date;
          var title = prompt("Etkinlik ekle (" + dt + "):");
          if (title) {
            ajax('/api/reminders', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({date: dt, text: title})
            }).then(function(data) {
              if (data.success) {
                if (!window.calendarEvents) window.calendarEvents = [];
                window.calendarEvents.push({id: data.id, date: dt, title: title});
                renderCalendar(year, month);
                
                var reminderList = document.getElementById('reminder-list');
                var remindersEmpty = document.getElementById('reminders-empty');
                if (reminderList) {
                  if (remindersEmpty) remindersEmpty.style.display = 'none';
                  var li = document.createElement('li');
                  li.className = 'reminder-item';
                  li.dataset.id = data.id;
                  li.innerHTML = '<time class="reminder-date">' + escapeHtml(dt) + '</time>' +
                    '<span class="reminder-text">' + escapeHtml(title) + '</span>' +
                    '<button class="btn-danger reminder-del-btn">DEL</button>';
                  reminderList.appendChild(li);
                }
              }
            }).catch(function(e) { alert("Hata: " + e.message); });
          }
        });
      });
    }

    // Load initial events from the DOM to avoid needing a server restart
    window.calendarEvents = Array.from($$('.reminder-item')).map(function(li) {
      var dateEl = li.querySelector('.reminder-date');
      var textEl = li.querySelector('.reminder-text');
      return {
        id: li.dataset.id,
        date: dateEl ? dateEl.textContent.trim() : '',
        title: textEl ? textEl.textContent.trim() : ''
      };
    });
    renderCalendar(currentYear, currentMonth);

    if (calPrev) {
      calPrev.addEventListener('click', function() {
        currentMonth--;
        if (currentMonth < 0) {
          currentMonth = 11;
          currentYear--;
        }
        renderCalendar(currentYear, currentMonth);
      });
    }

    if (calNext) {
      calNext.addEventListener('click', function() {
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
        renderCalendar(currentYear, currentMonth);
      });
    }
  }

  // --- Todo CRUD ---
  var todoForm = $('#todo-form');
  var todoList = $('#todo-list');
  var todoEmpty = $('#todo-empty');

  if (todoForm) {
    todoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('input[name="text"]', todoForm);
      var text = input.value.trim();
      if (!text) return;
      ajax('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      }).then(function (data) {
        if (data.success && todoList) {
          if (todoEmpty) todoEmpty.style.display = 'none';
          var li = document.createElement('li');
          li.className = 'task-item';
          li.dataset.id = data.id;
          li.innerHTML = '<input type="checkbox" class="todo-check">' +
            '<span class="task-text">' + escapeHtml(data.text) + '</span>' +
            '<button class="btn-danger todo-del-btn">DEL</button>';
          todoList.prepend(li);
          input.value = '';
        }
      }).catch(function () {});
    });

    if (todoList) {
      todoList.addEventListener('click', function (e) {
        var li = e.target.closest('.task-item');
        if (!li) return;
        var id = li.dataset.id;

        if (e.target.classList.contains('todo-check')) {
          ajax('/api/todos/' + id + '/toggle', { method: 'POST' }).then(function (data) {
            if (data.success) {
              li.classList.toggle('done');
            }
          }).catch(function () {});
        }

        if (e.target.classList.contains('todo-del-btn')) {
          e.preventDefault();
          ajax('/api/todos/' + id + '/delete', { method: 'POST' }).then(function (data) {
            if (data.success) li.remove();
          }).catch(function () {});
        }
      });
    }
  }

  // --- Scratchpad (Notes) ---
  var noteForm = $('#note-form');
  var scratchpadClear = $('#scratchpad-clear');
  if (noteForm) {
    noteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var textarea = $('textarea[name="text"]', noteForm);
      var text = textarea.value.trim();
      if (!text) return;
      ajax('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      }).then(function () {
        // Stay on current text (saved)
      }).catch(function () {});
    });
    if (scratchpadClear) {
      scratchpadClear.addEventListener('click', function () {
        $('textarea[name="text"]', noteForm).value = '';
      });
    }
  }

  // --- Reminders ---
  var reminderForm = $('#reminder-form');
  var reminderList = $('#reminder-list');
  var remindersEmpty = $('#reminders-empty');

  if (reminderForm) {
    reminderForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var dateInput = $('input[name="date"]', reminderForm);
      var textInput = $('input[name="text"]', reminderForm);
      var date = dateInput.value;
      var text = textInput.value.trim();
      if (!date || !text) return;
      ajax('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: date, text: text })
      }).then(function (data) {
        if (data.success && reminderList) {
          if (remindersEmpty) remindersEmpty.style.display = 'none';
          var li = document.createElement('li');
          li.className = 'reminder-item';
          li.dataset.id = data.id;
          li.innerHTML = '<time class="reminder-date">' + escapeHtml(data.date) + '</time>' +
            '<span class="reminder-text">' + escapeHtml(data.text) + '</span>' +
            '<button class="btn-danger reminder-del-btn">DEL</button>';
          reminderList.appendChild(li);
          dateInput.value = '';
          textInput.value = '';
          
          if (window.calendarEvents) {
            window.calendarEvents.push({id: data.id, date: data.date, title: data.text});
            if (window.updateCalendarView) window.updateCalendarView();
          }
        }
      }).catch(function () {});
    });
    if (reminderList) {
      reminderList.addEventListener('click', function (e) {
        if (e.target.classList.contains('reminder-del-btn')) {
          e.preventDefault();
          var li = e.target.closest('.reminder-item');
          if (!li) return;
          ajax('/api/reminders/' + li.dataset.id + '/delete', { method: 'POST' }).then(function (data) {
            if (data.success) {
              li.remove();
              if (window.calendarEvents) {
                window.calendarEvents = window.calendarEvents.filter(function(ev) { return ev.id != li.dataset.id; });
                if (window.updateCalendarView) window.updateCalendarView();
              }
            }
          }).catch(function () {});
        }
      });
    }
  }

  // --- Bookmarks CRUD ---
  var bmForm = $('#bookmark-form');
  var bmList = $('#bookmark-list');
  var bmEmpty = $('#bookmarks-empty');

  if (bmForm) {
    bmForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var titleInput = $('input[name="title"]', bmForm);
      var urlInput = $('input[name="url"]', bmForm);
      var title = titleInput.value.trim();
      var url = urlInput.value.trim();
      if (!url) return;
      ajax('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, url: url })
      }).then(function (data) {
        if (data.success && bmList) {
          if (bmEmpty) bmEmpty.style.display = 'none';
          var li = document.createElement('li');
          li.className = 'bookmark-item';
          li.dataset.id = data.id;
          li.innerHTML = '<a href="' + escapeHtml(data.url) + '" target="_blank" rel="noopener">' + escapeHtml(data.title) + '</a>' +
            '<button class="btn-danger bm-del-btn">DEL</button>';
          bmList.prepend(li);
          titleInput.value = '';
          urlInput.value = '';
        }
      }).catch(function () {});
    });
    if (bmList) {
      bmList.addEventListener('click', function (e) {
        if (e.target.classList.contains('bm-del-btn')) {
          e.preventDefault();
          var li = e.target.closest('.bookmark-item');
          if (!li) return;
          ajax('/api/bookmarks/' + li.dataset.id + '/delete', { method: 'POST' }).then(function (data) {
            if (data.success) li.remove();
          }).catch(function () {});
        }
      });
    }
  }

  // --- Calculator ---
  var calcDisplay = $('#calc-display');

  if (calcDisplay) {
    window.calcExpr = '0';
    window.calcFresh = true;

    window.updateCalcDisplay = function() {
      calcDisplay.textContent = window.calcExpr;
    }

    window.safeCalc = function(expr) {
      if (!/^[\d+\-*/.\s()a-zA-Z^√]+$/.test(expr)) return 'Error';
      try {
        var parsed = expr
          .replace(/sin/g, 'Math.sin')
          .replace(/cos/g, 'Math.cos')
          .replace(/tan/g, 'Math.tan')
          .replace(/log/g, 'Math.log10')
          .replace(/√/g, 'Math.sqrt')
          .replace(/\^/g, '**');
        var result = new Function('return (' + parsed + ')')();
        if (!isFinite(result)) return 'Error';
        return parseFloat(result.toFixed(10)).toString();
      } catch (e) { return 'Error'; }
    }

    window.calcAction = function(val) {
      if (val === 'C' || val === 'CE') {
        window.calcExpr = '0';
        window.calcFresh = true;
      } else if (val === '=') {
        window.calcExpr = window.safeCalc(window.calcExpr);
        window.calcFresh = true;
      } else {
        if (window.calcFresh && /[\d(a-zA-Z√]/.test(val)) {
          window.calcExpr = val;
          window.calcFresh = false;
        } else {
          if (window.calcExpr === '0' && /[\d(a-zA-Z√]/.test(val)) { window.calcExpr = val; }
          else { window.calcExpr += val + (val.match(/[a-zA-Z√]/) ? '(' : ''); }
          window.calcFresh = false;
        }
      }
      window.updateCalcDisplay();
    }

    $$('.calc-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var val = btn.dataset.val;
        if (btn.id === 'calc-equals') val = '=';
        window.calcAction(val);
      });
    });

    var calcClearBtn = $('#calc-clear');
    if (calcClearBtn) {
      calcClearBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.calcAction('C');
      });
    }
  }

  // --- Chat ---
  var chatForm = $('#chat-form');
  var chatMessages = $('#chat-messages');
  var chatInput = $('#chat-input');
  var chatFile = $('#chat-file');
  var chatFileName = $('#file-name');
  var chatSend = $('#chat-send');
  var chatHistory = [];
  var chatHistoryList = $('#chat-history-list');
  var chatConversationCount = 0;

  if (chatForm && chatMessages && chatInput) {
    if (chatFile && chatFileName) {
      chatFile.addEventListener('change', function () {
        chatFileName.textContent = chatFile.files.length ? chatFile.files[0].name : '';
      });
    }

    function addChatLine(role, text) {
      var div = document.createElement('div');
      div.className = 'chat-line';
      
      // Image Generation Intercept
      var imgMatch = text.match(/\[RESIM:\s*(.*?)\]/);
      if (imgMatch) {
         var prompt = imgMatch[1];
         var seed = Math.floor(Math.random() * 100000);
         var imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?seed=' + seed + '&width=512&height=512&nologo=true';
         text = text.replace(imgMatch[0], '<br><img src="' + imgUrl + '" style="max-width:100%; border-radius:4px; margin-top:8px;" onload="this.scrollIntoView()"><br>');
      } else {
         text = escapeHtml(text);
      }

      if (role === 'system') {
        div.innerHTML = '<span class="chat-system">' + text + '</span>';
      } else {
        var labelClass = role === 'user' ? 'chat-label-user' : 'chat-label-bot';
        var label = role === 'user' ? 'YOU >' : 'ASSISTANT >';
        div.innerHTML = '<div class="' + labelClass + '">' + label + '</div><div class="chat-text">' + text + '</div>';
      }
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addThinking() {
      var div = document.createElement('div');
      div.className = 'chat-line';
      div.id = 'thinking-indicator';
      div.innerHTML = '<div class="chat-label-bot">ASSISTANT ></div><div class="chat-text" style="color:#808080;">Processing...</div>';
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeThinking() { var el = $('#thinking-indicator'); if (el) el.remove(); }

    function addToHistorySidebar(text) {
      if (!chatHistoryList) return;
      chatConversationCount++;
      var li = document.createElement('li');
      var shortText = text.length > 25 ? text.substring(0, 25) + '...' : text;
      li.innerHTML = '<a href="#">' + escapeHtml(shortText) + '</a>';
      chatHistoryList.prepend(li);
      while (chatHistoryList.children.length > 10) {
        chatHistoryList.removeChild(chatHistoryList.lastChild);
      }
    }

    chatForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var message = chatInput.value.trim();
      var hasFile = chatFile && chatFile.files.length > 0;
      if (!message && !hasFile) return;

      if (message) addChatLine('user', message);
      if (hasFile) addChatLine('user', '[FILE: ' + chatFile.files[0].name + ']');
      if (message) addToHistorySidebar(message);

      chatSend.disabled = true;
      addThinking();

      var promise;
      var modelSelect = $('#chat-model-select');
      var modelVal = modelSelect ? modelSelect.value : 'gemini';
      if (hasFile) {
        var formData = new FormData();
        formData.append('file', chatFile.files[0]);
        formData.append('message', message || '');
        formData.append('model', modelVal);
        promise = fetch('/api/chat/upload', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData
        }).then(function (r) { return r.json(); });
      } else {
        chatHistory.push({ role: 'user', text: message });
        if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
        promise = ajax('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message, history: chatHistory.slice(0, -1), model: modelVal })
        });
      }

      promise.then(function (data) {
        removeThinking();
        if (data.reply) {
          addChatLine('model', data.reply);
          if (!hasFile) chatHistory.push({ role: 'model', text: data.reply });
        } else if (data.error) {
          addChatLine('system', 'ERROR: ' + data.error);
        }
      }).catch(function () {
        removeThinking();
        addChatLine('system', 'ERROR: Connection failed.');
      }).finally(function () {
        chatSend.disabled = false;
        chatInput.value = '';
        if (chatFile) chatFile.value = '';
        if (chatFileName) chatFileName.textContent = '';
        chatInput.focus();
      });
    });
  }

  // --- SSR Form Intercepts ---
  $$('.todo-delete-form, .reminder-delete-form, .bm-delete-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ajax(form.action, { method: 'POST' }).then(function () {
        var li = form.closest('li') || form.closest('.bookmark-item');
        if (li) li.remove();
      }).catch(function () { form.submit(); });
    });
  });

  // --- AI Tools Logic (Translate, Paint, Scanner, TLDR, Concept) ---
  // Concept
  var engConcept = $('#eng-concept-content');
  if (engConcept) {
    ajax('/api/concept').then(function(d) {
      if(d.concept) engConcept.innerHTML = escapeHtml(d.concept).replace(/\n/g, '<br>');
    }).catch(function() {
      engConcept.innerHTML = '> ERROR FETCHING CONCEPT.';
    });
  }

  // Weather ASCII
  var weatherAscii = $('#weather-ascii');
  if (weatherAscii) {
    var cond = $('#weather-cond') ? $('#weather-cond').textContent.toLowerCase() : '';
    var frames = [];
    if (cond.includes('rain') || cond.includes('yağmur') || cond.includes('shower')) {
      frames = [
        "  /  /  / \n /  /  /  \n  /  /  / ",
        " /  /  /  \n  /  /  / \n /  /  /  "
      ];
    } else if (cond.includes('cloud') || cond.includes('bulut') || cond.includes('overcast')) {
      frames = [
        "   .--.   \n .-(    ). \n(___.__)__)"
      ];
    } else {
      frames = [
        " \\  |  / \n -- * -- \n /  |  \\ ",
        "  \\ | /  \n -- * -- \n  / | \\  "
      ];
    }
    var frameIdx = 0;
    setInterval(function() {
      weatherAscii.textContent = frames[frameIdx % frames.length];
      frameIdx++;
    }, 500);
  }

  // News TLDR
  $$('.tldr-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var contentDiv = btn.closest('.news-title').nextElementSibling;
      var base64Text = btn.dataset.text;
      var text = atob(base64Text);
      if(contentDiv.style.display === 'block') {
        contentDiv.style.display = 'none';
        return;
      }
      contentDiv.style.display = 'block';
      contentDiv.textContent = '> SUMMARIZING...';
      ajax('/api/tldr', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: text})
      }).then(function(d) {
        contentDiv.textContent = d.summary || '> NO SUMMARY';
      }).catch(function() {
        contentDiv.textContent = '> ERROR';
      });
    });
  });

  // Video TLDR
  $$('.vid-tldr-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var card = btn.closest('.video-card');
      var contentDiv = card ? card.querySelector('.vid-tldr-content') : btn.nextElementSibling;
      var title = decodeURIComponent(btn.dataset.title);
      var channel = decodeURIComponent(btn.dataset.channel);
      if(contentDiv.style.display === 'block') {
        contentDiv.style.display = 'none';
        return;
      }
      contentDiv.style.display = 'block';
      contentDiv.textContent = '> SUMMARIZING...';
      ajax('/api/youtube-tldr', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({title: title, channel: channel})
      }).then(function(d) {
        contentDiv.textContent = d.summary || '> NO SUMMARY';
      }).catch(function() {
        contentDiv.textContent = '> ERROR';
      });
    });
  });

  // Translate
  var transForm = $('#translate-form');
  if (transForm) {
    transForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = $('#trans-btn');
      btn.disabled = true;
      var res = $('#trans-result');
      res.value = 'Translating...';
      ajax('/api/translate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          text: $('#trans-source').value,
          sourceLang: $('#trans-source-lang') ? $('#trans-source-lang').value : 'Auto',
          targetLang: $('#trans-target-lang').value
        })
      }).then(function(d) {
        if(d.translation) res.value = d.translation;
        else res.value = 'Error.';
      }).catch(function(){ res.value = 'Error.'; }).finally(function(){
        btn.disabled = false;
      });
    });
  }

  // Paint
  var paintForm = $('#paint-form');
  if (paintForm) {
    paintForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = $('#paint-btn');
      var res = $('#paint-result');
      btn.disabled = true;
      res.innerHTML = 'GENERATING...';
      ajax('/api/paint', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ prompt: $('#paint-prompt').value })
      }).then(function(d) {
        if(d.imageBase64) res.innerHTML = '<img src="data:image/jpeg;base64,' + d.imageBase64 + '" style="max-width:100%; max-height:400px;">';
        else res.innerHTML = '[ERROR]';
      }).catch(function(){ res.innerHTML = '[ERROR]'; }).finally(function(){ btn.disabled = false; });
    });
  }

  // Scanner / TLDR
  var scannerForm = $('#scanner-form');
  if (scannerForm) {
    var fileIn = $('#scanner-file');
    fileIn.addEventListener('change', function() {
       $('#scanner-file-name').textContent = fileIn.files.length ? fileIn.files[0].name : 'No file selected';
    });
    scannerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = $('#scanner-btn');
      var res = $('#scanner-result');
      if(!fileIn.files.length) return;
      btn.disabled = true;
      res.value = 'PROCESSING...';
      var fd = new FormData();
      fd.append('file', fileIn.files[0]);
      fd.append('action', $('#scanner-action').value);
      fetch('/api/scanner', { method:'POST', body:fd })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if(d.result) res.value = d.result;
          else res.value = d.error || 'ERROR';
        }).catch(function() { res.value = 'ERROR'; })
        .finally(function() { btn.disabled = false; });
    });
  }

  // --- WIKIPEDIA SEARCH ---
  window.wikiGetir = async function() {
    var kelime = $('#aramaKutusu').value;
    var sonucAlani = $('#sonucAlani');
    var baslik = $('#wikiBaslik');
    var metin = $('#wikiMetin');
    var gorsel = $('#wikiGorsel');
    
    if (!kelime) return;
    
    var url = 'https://tr.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(kelime);
    
    try {
      sonucAlani.style.display = 'block';
      baslik.innerText = 'Aranıyor...';
      metin.innerText = '';
      gorsel.style.display = 'none';
      
      var cevap = await fetch(url);
      var veri = await cevap.json();
      
      if (veri.title === "Not found") {
        baslik.innerText = "Sonuç Bulunamadı";
        metin.innerText = "Aradığınız kelimeye dair Wikipedia'da bir sonuç yok.";
        gorsel.style.display = 'none';
        return;
      }
      
      baslik.innerText = veri.title;
      metin.innerText = veri.extract || "Özet bulunamadı.";
      
      if (veri.thumbnail && veri.thumbnail.source) {
        gorsel.src = veri.thumbnail.source;
        gorsel.style.display = 'block';
      } else {
        gorsel.style.display = 'none';
      }
    } catch (hata) {
      baslik.innerText = "Hata";
      metin.innerText = "Bağlantı hatası oluştu.";
    }
  };

  // --- ARTICLE READER (Mozilla Readability) ---
  $$('.read-article-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var url = btn.dataset.url;
      var readerContainer = $('#article-reader');
      var readerTitle = $('#reader-title');
      var readerContent = $('#reader-content');
      
      if (readerContainer) {
        readerContainer.style.display = 'block';
        readerTitle.innerText = 'Yükleniyor... / Loading...';
        readerContent.innerHTML = '<div style="text-align:center; padding: 20px;">Fetching and parsing article text (ad-free)...</div>';
        
        ajax('/api/read-article', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ url: url })
        }).then(function(d) {
          if(d.error) {
            readerTitle.innerText = 'Hata / Error';
            readerContent.innerHTML = '<div style="color:red;">' + escapeHtml(d.error) + '</div>';
          } else {
            readerTitle.innerText = d.title || 'Makale';
            // We use innerHTML because Mozilla Readability returns clean HTML
            readerContent.innerHTML = d.htmlContent || d.content;
          }
        }).catch(function() {
          readerTitle.innerText = 'Hata / Error';
          readerContent.innerHTML = '<div style="color:red;">Bağlantı hatası oluştu. Node.js backend proxy failed.</div>';
        });
      }
    });
  });

  // --- Saved Chats Logic ---
  var chatSelect = $('#chat-history-select');
  var btnLoadChat = $('#btn-load-chat');
  var btnDelChat = $('#btn-del-chat');
  var btnSaveChat = $('#btn-save-chat');

  function loadSavedChats() {
    if (!chatSelect) return;
    ajax('/api/saved-chats').then(function(chats) {
      chatSelect.innerHTML = '<option value="">-- Seç --</option>';
      chats.forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        opt.dataset.history = c.history; // stored as JSON string in DB
        chatSelect.appendChild(opt);
      });
    }).catch(console.error);
  }
  loadSavedChats();

  if (btnSaveChat) {
    btnSaveChat.addEventListener('click', function() {
      // Find the chat variables from the outer scope if available, or just check chatHistory
      if (typeof chatHistory === 'undefined' || chatHistory.length === 0) {
        alert("Kaydedilecek sohbet yok!");
        return;
      }
      var title = prompt("Sohbet için bir başlık girin:");
      if (!title) return;
      ajax('/api/saved-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, history: chatHistory })
      }).then(function(res) {
        if (res.success) {
          alert("Sohbet kaydedildi!");
          loadSavedChats();
        }
      }).catch(function(e) { alert("Hata: " + e.message); });
    });
  }

  if (btnLoadChat) {
    btnLoadChat.addEventListener('click', function() {
      if (!chatSelect || !chatSelect.value) return;
      var selectedOpt = chatSelect.options[chatSelect.selectedIndex];
      try {
        var hist = JSON.parse(selectedOpt.dataset.history);
        if (typeof chatHistory !== 'undefined') {
          chatHistory = hist; // Replace global chatHistory array
        }
        var chatMessages = $('#chat-messages');
        if (chatMessages) {
          chatMessages.innerHTML = '<div class="chat-line chat-system">Loaded Chat: ' + escapeHtml(selectedOpt.textContent) + '</div><hr class="chat-separator">';
          hist.forEach(function(msg) {
            var el = document.createElement('div');
            el.className = 'chat-line ' + (msg.role === 'user' ? 'chat-user' : 'chat-model');
            el.innerHTML = '<strong>' + (msg.role === 'user' ? 'USER' : 'AI') + '</strong>: ' + (msg.text || '').replace(/\n/g, '<br>');
            chatMessages.appendChild(el);
          });
          chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
          alert("Sohbeti görmek için AI Assistant (Chat) sayfasına gidin.");
        }
      } catch(e) {
        alert("Sohbet yüklenirken hata oluştu.");
      }
    });
  }

  if (btnDelChat) {
    btnDelChat.addEventListener('click', function() {
      if (!chatSelect || !chatSelect.value) return;
      if (!confirm("Seçili sohbeti silmek istiyor musunuz?")) return;
      ajax('/api/saved-chats/' + chatSelect.value + '/delete', { method: 'POST' }).then(function(res) {
        if (res.success) {
          loadSavedChats();
        }
      }).catch(function(e) { alert("Hata: " + e.message); });
    });
  }

})();
