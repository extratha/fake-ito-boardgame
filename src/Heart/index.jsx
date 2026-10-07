
import '../App.css'
const HeartDisplay = ({ roomId, heart, setHeart, onReduceHeart, onResetHeart }) => {

  const handleReduceHeart = async () => {
    onReduceHeart()
  };

  const handleResetHeart = () => {
    onResetHeart()
  };

  return (
    <section className="card">
      <div className="hearts" role="img" aria-label={`หัวใจเหลือ ${heart} จาก 3`}>
        {[...Array(3)].map((_, index) => {
          const isLost = index < 3 - heart;
          return (
            <svg
              key={index}
              className={`heart ${isLost ? 'heart-lost' : ''}`}
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill={isLost ? '#475569' : '#ef4444'}
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          );
        })}
      </div>
      <div className="button-row">
        <button className="button-common btn-danger" onClick={handleReduceHeart} disabled={heart < 1}>ลด 1 หัวใจ</button>
        <button className="button-common" onClick={handleResetHeart}>รีหัวใจ</button>
      </div>
    </section>
  );
};

export default HeartDisplay;
