# Routes
All routes of the app are in this folder. So no file-based routing, yet. We are still unsure of the benefits in terms of readability and maintainability.

### Good to know
* We use type-safe Tanstack [react-router](https://tanstack.com/router).
* Recommended way of querying is directly in the route's `loader`. It offers many possibilities. One of those is parallel loading in nested routes, to prevent waterfall.
* Router instance is created in `/lib/router.ts` [Code link](/frontend/src/lib/router.ts)
* For querying in loaders, we use [react-query](https://tanstack.com/query) `queryClient` [Code link](/frontend/src/lib/query-client.ts)

For example code, it is recommended to look at [routes/organizations.tsx](/frontend/src/routes/organizations.tsx)