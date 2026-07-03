function Card() {
  return (
    <div className="flex hidden p-4 p-8 md:flex-row">
      <button className="text-left text-right font-bold bg-blue-500 hover:bg-red-500">
        Click me
      </button>
      <span className="w-full md:w-1/2">OK class list, no conflict</span>
    </div>
  );
}
