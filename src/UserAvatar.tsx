import { useStore } from './store'
import { Avatar } from './ui'

/** Avatar that shows the user's uploaded photo when there is one (matched by id, or by name), otherwise initials. */
export function UserAvatar({ name, id, size }: { name: string; id?: number; size?: number }) {
  const { users } = useStore()
  const u = id !== undefined ? users.find(x => x.id === id) : users.find(x => x.name === name)
  return <Avatar name={u?.name ?? name} src={u?.avatar} size={size} />
}
