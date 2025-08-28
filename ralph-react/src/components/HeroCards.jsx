export default function HeroCards() {
  // Simple playful stack of card faces and backs using divs and Tailwind
  const Card = ({ children, rotate = 0, x = 0, y = 0, back = false }) => (
    <div
      className={`absolute w-24 h-36 rounded-xl shadow-2xl border border-gray-300 ${
        back ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-500' : 'bg-[#FFF8E7]'
      } flex items-center justify-center`}
      style={{ transform: `rotate(${rotate}deg) translate(${x}px, ${y}px)` }}
    >
      {!back ? (
        <div className="text-3xl font-extrabold select-none">
          {children}
        </div>
      ) : (
        <div className="w-16 h-24 rounded-lg bg-white/20 border border-white/30" />
      )}
    </div>
  )
  return (
    <div className="relative w-[420px] h-[260px]">
      {/* Backs */}
      <Card back rotate={-18} x={-120} y={30} />
      <Card back rotate={14} x={130} y={20} />
      {/* Faces */}
      <Card rotate={-8} x={-60} y={-8}>Q♠</Card>
      <Card rotate={6} x={60} y={-10}>K♥</Card>
      <Card rotate={-2} x={0} y={8}>A♦</Card>
      <Card rotate={10} x={-5} y={-30}>J♣</Card>
    </div>
  )
}
