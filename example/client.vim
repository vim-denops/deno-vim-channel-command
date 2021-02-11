let s:root = expand('<sfile>:h')
let s:server = join([s:root, 'server.ts'], has('win32') ? '\' : '/')

function! s:start_server() abort
  let job = job_start(['deno', 'run', '-A', '--unstable', s:server], {
        \ 'mode': 'json',
        \ 'err_cb': funcref('s:err_cb'),
        \ 'exit_cb': funcref('s:exit_cb'),
        \ 'env': {
        \   'NO_COLOR': 1,
        \ }
        \})
endfunction

function! s:err_cb(ch, msg) abort
  echomsg a:msg
endfunction

function! s:exit_cb(ch, status) abort
  echomsg printf('Server is closed: %d', a:status)
endfunction


command! StartServer call s:start_server()
