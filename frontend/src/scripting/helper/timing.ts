export const TimeIt = (func, interval = 60) => {
  let i = 0;
  let values = [];

  return () => {
    const start = performance.now();
    func();
    const end = performance.now();

    values.push(end - start);
    if (++i % interval == 0) {
      values.sort();
      console.log(
        `${func.name}\n\tMax ${values[values.length - 1].toFixed(
          2
        )} ms\n\tMedian ${values[Math.floor(values.length / 2)].toFixed(2)} ms`
      );

      values = [];
    }
  };
};
