Log in to the mobile frontend running locally at http://localhost:8100 using the non-admin test user credentials from `apps/backend/.env` (`SECOND_USER_EMAIL` / `SECOND_USER_PASSWORD`).

Use the openbrowser MCP plugin. Standard form input doesn't work with the Ionic login page — invoke the React AuthProvider's `login` function directly via the React fiber tree instead.

Steps:
1. Navigate to http://localhost:8100 and wait for it to load.
2. Call the login function via the fiber tree using the credentials from `.env` (`thedinj@gmail.com` / `dinj86`).
3. After a successful login response, navigate to the desired route (default: http://localhost:8100/cards).
4. Confirm the page loaded correctly by checking the browser state.

Login code to execute via `mcp__plugin_openbrowser_openbrowser__execute_code`:

```python
navigate = __ns__['navigate']
wait = __ns__['wait']
evaluate = __ns__['evaluate']
browser = __ns__['browser']

await navigate("http://localhost:8100")
await wait(3)

result = await evaluate("""
    (async () => {
        function findFiberByType(node, name, depth=0) {
            if (!node || depth > 200) return null;
            const n = node.type?.displayName || node.type?.name || '';
            if (n.includes(name)) return node;
            let r = null;
            if (node.child) r = findFiberByType(node.child, name, depth+1);
            if (!r && node.sibling) r = findFiberByType(node.sibling, name, depth+1);
            return r;
        }
        const container = document.getElementById('root');
        const fiberKey = Object.keys(container).find(k => k.startsWith('__reactContainer'));
        const fiber = container[fiberKey];
        const authFiber = findFiberByType(fiber, 'Auth');
        // Hook index 3 is the login useCallback; memoizedState[0] is the function
        let hook = authFiber.memoizedState;
        for (let i = 0; i < 3; i++) hook = hook.next;
        const loginFn = hook.memoizedState[0];
        const res = await loginFn('thedinj@gmail.com', 'dinj86');
        return res;
    })()
""")
print(result)
```

After confirming `result.ok === true`, navigate to the target page:

```python
await navigate("http://localhost:8100/cards")
await wait(3)
state = await browser.get_state_as_text()
print(state[:1000])
```

If the hook index shifts (login function not found), walk the AuthProvider hooks and look for the one whose `memoizedState[0].toString()` contains `apiClient.login`.

Note: the login fires an HTTP `POST /api/auth/login` to port 3000 (backend). Both dev servers must be running:
- `pnpm --filter backend dev` (port 3001 — check PORT in `.env`)
- `pnpm --filter mobile dev` (port 8100)
