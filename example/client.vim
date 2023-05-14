let s:root = expand('<sfile>:h')
let s:server = join([s:root, 'server.ts'], has('win32') ? '\' : '/')

function! s:start_server() abort
  call job_start(['deno', 'run', '-A', '--unstable', s:server], {
        \ 'mode': 'json',
        \ 'err_mode': 'nl',
        \ 'err_cb': funcref('s:err_cb'),
        \ 'env': {
        \   'NO_COLOR': 1,
        \ },
        \ 'noblock': 1,
        \ 'pty': 0,
        \})
  echomsg 'Server is started'
endfunction

function! s:err_cb(ch, msg, ...) abort
  echomsg "Recv:" .. a:msg
endfunction

call s:start_server()
