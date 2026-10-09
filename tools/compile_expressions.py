import ast,re,json,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def compile_expr(expr):
    # Replace native game-engine function calls with an explicit unsupported AST node.
    names=[]
    def func(m):names.append(m[1]);return 'N'+str(len(names)-1)+'('
    s=re.sub(r'@([\w.]+)\(',func,expr)
    def bare(m):names.append(m[1]);return 'N'+str(len(names)-1)+'()'
    s=re.sub(r'@([\w.]+)',bare,s)
    s=re.sub(r'#(\d+)',r'V(\1)',s)
    s=re.sub(r'\$(\d+)',r'S(\1)',s).replace('&&',' and ').replace('||',' or ')
    s=re.sub(r'!(?!=)',' not ',s).strip()
    def walk(n):
        if isinstance(n,ast.Constant):
            if isinstance(n.value,(int,float)):return n.value
            if isinstance(n.value,str):return ['string',n.value]
            raise ValueError('constant')
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Name):
            if n.func.id=='V' and len(n.args)==1:return ['v',walk(n.args[0])]
            if n.func.id=='S' and len(n.args)==1:return ['s',walk(n.args[0])]
            if n.func.id.startswith('N'):return ['native',names[int(n.func.id[1:])]]
        if isinstance(n,ast.Subscript) and isinstance(n.value,ast.Call) and n.value.func.id=='V':return ['v',['+',walk(n.value.args[0]),walk(n.slice)]]
        if isinstance(n,ast.UnaryOp):return [{ast.Not:'!',ast.USub:'neg',ast.UAdd:'pos',ast.Invert:'~'}[type(n.op)],walk(n.operand)]
        if isinstance(n,ast.BinOp):return [{ast.Add:'+',ast.Sub:'-',ast.Mult:'*',ast.Div:'/',ast.Mod:'%',ast.BitAnd:'&',ast.BitOr:'|',ast.BitXor:'^',ast.LShift:'<<',ast.RShift:'>>'}[type(n.op)],walk(n.left),walk(n.right)]
        if isinstance(n,ast.BoolOp):return ['&&' if isinstance(n.op,ast.And) else '||']+[walk(v) for v in n.values]
        if isinstance(n,ast.Compare):
            if len(n.ops)!=1:raise ValueError('chained comparison')
            return [{ast.Eq:'==',ast.NotEq:'!=',ast.Lt:'<',ast.LtE:'<=',ast.Gt:'>',ast.GtE:'>='}[type(n.ops[0])],walk(n.left),walk(n.comparators[0])]
        raise ValueError(ast.dump(n))
    return walk(ast.parse(s,mode='eval').body)
