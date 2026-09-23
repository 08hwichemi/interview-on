
window.__calls = [];
window.__DB = { interview: null, answers: [], favorites: (window.__SEEDFAV__ || []),
                interviews: (window.__SEEDIVS__ || []), reads: (window.__SEEDREADS__ || []),
                messages: (window.__MSGS__ = window.__MSGS__ || []) };
function __chats(){ try { const v=localStorage.getItem('__chats'); return v?JSON.parse(v):[]; } catch(e){ return []; } }
function __saveChats(a){ try { localStorage.setItem('__chats', JSON.stringify(a)); } catch(e){} }
window.supabase = {
  createClient: function () {
    const F = window.__FAKE__;
    function builder(table) {
      const st = { table, op: 'select', payload: null };
      const b = {
        select() { return b; },
        insert(v) { st.op='insert'; st.payload=v; window.__calls.push({table,op:'insert',v});
                    if (table==='chats') {
                      const all=__chats();
                      all.push(Object.assign({ id:'c'+(all.length+1), is_read:false,
                        created_at:new Date().toISOString() }, v));
                      __saveChats(all);
                    }
                    if (table==='interview_answers') {
                      (Array.isArray(v)?v:[v]).forEach(function(r){ window.__DB.answers.push(Object.assign({},r)); });
                    }
                    if (table==='chats') rows = __chats();
          else if (table==='report_messages') {
                      const row = Object.assign({ id:'m'+(window.__DB.messages.length+1),
                        created_at:new Date().toISOString() }, v);
                      window.__DB.messages.push(row);
                      // 다른 창에도 보이도록 공유 저장소에 남깁니다
                      try { localStorage.setItem('__msgs', JSON.stringify(window.__DB.messages)); } catch(e){}
                    }
                    return b; },
        upsert(v) { st.op='upsert'; st.payload=v; window.__calls.push({table,op:'upsert',v});
                    if (table==='report_reads') {
                      const i = window.__DB.reads.findIndex(r=>r.interview_id===v.interview_id);
                      if (i>-1) window.__DB.reads[i]=Object.assign({},v); else window.__DB.reads.push(Object.assign({},v));
                    }
                    if (table==='teacher_favorites' &&
                        !window.__DB.favorites.some(f=>f.student_id===v.student_id))
                      window.__DB.favorites.push({student_id:v.student_id});
                    if (table==='interview_answers') {
                      const i = window.__DB.answers.findIndex(a=>a.seq===v.seq);
                      if (i>-1) window.__DB.answers[i]=Object.assign({},v); else window.__DB.answers.push(Object.assign({},v));
                    }
                    return b; },
        update(v) { st.op='update'; st.payload=v; window.__calls.push({table,op:'update',v});
                    if (table==='chats') { st.patch=v; }
                    if (table==='interviews' && window.__DB.interview) Object.assign(window.__DB.interview, v);
                    return b; },
        delete() { st.op='delete'; window.__calls.push({table,op:'delete'});
                   if (table==='interviews') { window.__DB.interview=null; window.__DB.answers=[]; }
                   // eq() 는 delete() 뒤에 불리므로, 실제 삭제는 then() 에서 합니다
                   return b; },
        eq(k,v) { st['eq_'+k]=v; return b; },
        neq(k,v) { st['ne_'+k]=v; return b; },
        limit(n) { st.limit=n; return b; },
        range(from, to) { st.rangeFrom=from; st.rangeTo=to; return b; },
        in(k,vals) { st['in_'+k]=vals; return b; },
        or(expr) { st.or = expr; return b; },
        order(col, opts) { st.orderBy=col; st.orderAsc = !opts || opts.ascending !== false; return b; },
        single() {
          if (st.op==='insert' && table==='interviews') {
            window.__DB.interview = Object.assign({ id:'iv-1', status:'진행중', grades:{}, total_seconds:0,
              started_at:new Date().toISOString(), overall_note:'' }, st.payload, { id:'iv-1' });
            window.__DB.answers = [];
            return Promise.resolve({ data:{ id:'iv-1' }, error:null });
          }
          return Promise.resolve({ data:(F.rows[table]||[])[0]||null, error:null });
        },
        maybeSingle() {
          if (table==='interviews' && st.eq_id) return Promise.resolve({
            data: window.__DB.interviews.find(x=>x.id===st.eq_id) || window.__DB.interview, error:null });
          if (table==='profiles') return Promise.resolve({ data:F.profile, error:null });
          return Promise.resolve({ data:F.profile, error:null });
        },
        then(res,rej) {
          if (st.op==='update' && table==='chats') {
            const all=__chats();
            all.forEach(function(r){
              let hit=true;
              Object.keys(st).forEach(function(k){
                if (k.indexOf('eq_')!==0) return;
                if (String(r[k.slice(3)]) !== String(st[k])) hit=false;
              });
              if (hit) Object.assign(r, st.patch);
            });
            __saveChats(all);
          }
          if (st.op==='delete' && table==='interview_answers')
            window.__DB.answers = [];
          if (st.op==='delete' && table==='teacher_favorites')
            window.__DB.favorites = window.__DB.favorites.filter(f=>f.student_id!==st.eq_student_id);
          if (st.op!=='select') return Promise.resolve({data:null,error:null}).then(res,rej);
          let rows;
          if (table==='chats') rows = __chats();
          else if (table==='report_messages') {
            try { const shared = localStorage.getItem('__msgs');
                  if (shared) window.__DB.messages = JSON.parse(shared); } catch(e){}
            rows = window.__DB.messages.slice();
          }
          else if (table==='teacher_favorites') rows = window.__DB.favorites.slice();
          else if (table==='report_reads') rows = window.__DB.reads.slice();
          else if (table==='interview_answers') rows = window.__DB.answers.slice().sort((a,b)=>a.seq-b.seq);
          else if (table==='interviews') rows = window.__DB.interviews.length ? window.__DB.interviews.slice()
                                    : (window.__DB.interview ? [window.__DB.interview] : []);
          else rows = F.rows[table]||[];
          // 앱이 보낸 eq() 조건을 실제로 걸러 줍니다.
          // 안 그러면 «걸렀는데 그대로 다 나오는» 것을 못 잡습니다.
          if (st.or) {
            const conds = st.or.split(',').map(function(c){
              const m = c.match(/^(\w+)\.eq\.(.+)$/); return m ? {col:m[1], val:m[2]} : null;
            }).filter(Boolean);
            rows = rows.filter(r => conds.some(c => String(r[c.col]) === c.val));
          }
          Object.keys(st).forEach(function(k){
            if (k.indexOf('in_')===0) { const col=k.slice(3);
              rows = rows.filter(r => st[k].indexOf(r[col]) > -1); return; }
            if (k.indexOf('ne_')===0) { const col=k.slice(3);
              rows = rows.filter(r => String(r[col]) !== String(st[k])); return; }
            if (k.indexOf('eq_')!==0) return;
            const col = k.slice(3), want = st[k];
            rows = rows.filter(r => String(r[col]) === String(want));
          });
          // 진짜 서버처럼 정렬합니다. 안 하면 «마지막 한 마디» 가 엉뚱하게 나옵니다.
          if (st.orderBy) {
            rows = rows.slice().sort(function(a,z){
              const x=a[st.orderBy], y=z[st.orderBy];
              if (x===y) return 0;
              return (x>y?1:-1) * (st.orderAsc?1:-1);
            });
          }
          if (st.limit) rows = rows.slice(0, st.limit);
          if (st.rangeFrom != null) rows = rows.slice(st.rangeFrom, st.rangeTo + 1);
          return Promise.resolve({data:rows,error:null}).then(res,rej);
        }
      };
      return b;
    }
    return {
      auth:{ getSession(){return Promise.resolve({data:{session:{user:{id:'u1'}}}});},
             getUser(){return Promise.resolve({data:{user:{id:'u1'}}});},
             signOut(){return Promise.resolve({});} },
      from: builder,
      functions:{ invoke(){ return Promise.resolve({data:{},error:null}); } },
      channel(){ const ch={ on(){return ch;}, subscribe(){ window.__realtimeOn=true; return ch; } }; return ch; },
      removeChannel(){ return Promise.resolve(); }
    };
  }
};
