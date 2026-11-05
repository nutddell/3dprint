// Minimal typings for the parts of clipper-lib (Clipper 6 JS port) this app uses.
declare module 'clipper-lib' {
  namespace ClipperLib {
    interface IntPoint {
      X: number
      Y: number
    }
    type Path = IntPoint[]
    type Paths = Path[]

    class PolyNode {
      Contour(): Path
      Childs(): PolyNode[]
      IsHole(): boolean
    }
    class PolyTree extends PolyNode {}

    const PolyType: { ptSubject: number; ptClip: number }
    const ClipType: { ctIntersection: number; ctUnion: number; ctDifference: number; ctXor: number }
    const PolyFillType: { pftEvenOdd: number; pftNonZero: number; pftPositive: number; pftNegative: number }
    const JoinType: { jtSquare: number; jtRound: number; jtMiter: number }
    const EndType: { etClosedPolygon: number; etClosedLine: number; etOpenButt: number; etOpenSquare: number; etOpenRound: number }

    class Clipper {
      AddPath(path: Path, polyType: number, closed: boolean): boolean
      AddPaths(paths: Paths, polyType: number, closed: boolean): boolean
      Execute(clipType: number, solution: Paths | PolyTree, subjFill: number, clipFill: number): boolean
      static Orientation(path: Path): boolean
      static GetBounds(paths: Paths): { left: number; top: number; right: number; bottom: number }
    }
    class ClipperOffset {
      constructor(miterLimit?: number, arcTolerance?: number)
      AddPaths(paths: Paths, joinType: number, endType: number): void
      Execute(solution: Paths, delta: number): void
    }
  }
  export default ClipperLib
}
